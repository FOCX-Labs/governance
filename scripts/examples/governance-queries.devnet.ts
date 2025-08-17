#!/usr/bin/env ts-node
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, getMint } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Governance } from "../../target/types/governance";

dotenv.config({ path: ".env" });

function loadKeypair(filename: string): Keypair {
  const p = path.join(__dirname, "..", "..", "keys", filename);
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(d));
}

function u64LeBytes(n: anchor.BN): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n.toString()));
  return b;
}

async function initProgram(): Promise<{ program: Program<Governance>; provider: AnchorProvider }> {
  const rpcUrl = process.env.DEVNET_RPC || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const authority = loadKeypair("authority.json");
  const provider = new AnchorProvider(connection, new Wallet(authority), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = anchor.workspace.Governance as Program<Governance>;
  if (!program)
    throw new Error(
      "Unable to load Governance program via anchor.workspace, please run anchor build first"
    );
  return { program, provider };
}

export async function getTotalProposalCount(): Promise<number> {
  const { program } = await initProgram();
  const [governanceConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("governance_config")],
    program.programId
  );
  const cfg = await program.account.governanceConfig.fetch(governanceConfigPda);
  return Number(cfg.proposalCounter);
}

export async function getTotalVotingPower(): Promise<string> {
  const { program, provider } = await initProgram();
  const { connection } = provider;

  // Get governance configuration, obtain committee token mint and member list
  const [governanceConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("governance_config")],
    program.programId
  );
  const cfg: any = await program.account.governanceConfig.fetch(governanceConfigPda);
  const committeeMint: PublicKey = cfg.committeeTokenMint as PublicKey;
  const members: (PublicKey | null)[] = (cfg.committeeMembers || []) as any[];

  // Get mint precision to convert raw amount to readable number
  const mintInfo = await getMint(connection, committeeMint);
  const decimals = mintInfo.decimals;

  // Iterate through members, aggregate their ATA balances
  let totalRaw = BigInt(0);
  for (const m of members) {
    if (!m) continue;
    const owner = new PublicKey(m.toString());
    const ata = await getAssociatedTokenAddress(committeeMint, owner);
    try {
      const info = await getAccount(connection, ata);
      totalRaw += BigInt(info.amount.toString());
    } catch {
      // No ATA or no tokens held, treat as 0
    }
  }

  // Return both: raw value and human-readable value (string)
  const human = Number(totalRaw) / Math.pow(10, decimals);
  console.log(`ℹ️ Total Voting Power (raw): ${totalRaw.toString()}`);
  console.log(`ℹ️ Total Voting Power (human): ${human}`);
  return totalRaw.toString();
}

export async function getProposalDetail(proposalId: number) {
  const { program } = await initProgram();
  const [proposalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal"), Buffer.from(u64LeBytes(new anchor.BN(proposalId)))],
    program.programId
  );
  const p = await program.account.proposal.fetch(proposalPda);
  return { address: proposalPda.toBase58(), data: p };
}

/**
 * 🚀 High-performance cache-free voting account discovery solution
 * Built on committee member PDAs, avoiding full program account scanning
 * Performance target: <1500ms (48%+ improvement over original 2903ms)
 * Complexity: optimized from O(n) to O(m), where m = number of committee members
 */
export async function getProposalVoteAccountsSimpleOptimized(
  proposalId: number
): Promise<Array<{ pubkey: PublicKey; isWritable: boolean; isSigner: false }>> {
  console.log(`🚀 Simplified optimization solution: Get vote accounts for proposal ${proposalId}`);
  const startTime = Date.now();

  try {
    const { program, provider } = await initProgram();
    const { connection } = provider;
    const proposalIdBN = new anchor.BN(proposalId);

    // Step 1: Get committee member list
    const [governanceConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_config")],
      program.programId
    );
    const govConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
    const committeeMembers = govConfig.committeeMembers.filter(
      (member) => member && !member.equals(PublicKey.default)
    );

    console.log(`👥 Committee member count: ${committeeMembers.length}`);

    // Step 2: Build vote PDAs based on committee members
    const votePDAs = committeeMembers.map((member) => {
      const [votePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vote"), proposalIdBN.toArrayLike(Buffer, "le", 8), member.toBuffer()],
        program.programId
      );
      return votePda;
    });

    console.log(`🔍 Batch querying ${votePDAs.length} vote PDAs`);

    // Step 3: Batch query account information (core optimization)
    const accountInfos = await connection.getMultipleAccountsInfo(votePDAs);

    // Step 4: Process query results
    const voteAccounts = [];
    for (let i = 0; i < votePDAs.length; i++) {
      const accountInfo = accountInfos[i];
      if (accountInfo && accountInfo.data.length === 76) {
        // Verify proposal ID match
        const proposalIdBytes = accountInfo.data.slice(8, 16);
        const accountProposalId = new anchor.BN(proposalIdBytes, "le");

        if (accountProposalId.eq(proposalIdBN)) {
          voteAccounts.push({
            pubkey: votePDAs[i],
            isWritable: false,
            isSigner: false,
          });
          console.log(`✅ Found vote account: ${votePDAs[i].toString().slice(0, 8)}...`);
        }
      }
    }

    const queryTime = Date.now() - startTime;
    console.log(`🎯 Query completed: ${queryTime}ms, found ${voteAccounts.length} vote accounts`);
    console.log(
      `📊 Performance level: ${
        queryTime < 500
          ? "🚀 Ultra-fast"
          : queryTime < 1000
          ? "⚡ Fast"
          : queryTime < 1500
          ? "✅ Good"
          : "⚠️ Needs optimization"
      }`
    );

    return voteAccounts;
  } catch (error) {
    console.error(`❌ Optimized query failed: ${error.message}`);
    throw new Error(`Unable to get vote accounts for proposal ${proposalId}: ${error.message}`);
  }
}

async function main() {
  try {
    console.log("\nℹ️ Getting total proposal count for governance system...");
    const total = await getTotalProposalCount();
    console.log("✅ Total proposal count:", total);
  } catch (e: any) {
    console.error("❌ Failed to get proposal count:", e.message || e);
  }

  try {
    console.log("\nℹ️ Getting total voting power for governance system...");
    const tvp = await getTotalVotingPower();
    console.log("✅ Total voting power:", tvp);
  } catch (e: any) {
    console.error("❌ Failed to get total voting power:", e.message || e);
  }

  try {
    const id = Number(process.argv[2] || 237); // Default to tested proposal 237
    console.log(`\nℹ️ Getting details for proposal ID=${id}...`);
    const { address, data } = await getProposalDetail(id);
    console.log("✅ Proposal address:", address);
    console.log("✅ Proposal title:", data.title);
    console.log("✅ Proposal status:", data.status);
  } catch (e: any) {
    console.error("❌ Failed to get proposal details:", e.message || e);
  }

  // Test simplified optimization solution
  try {
    const id = Number(process.argv[2] || 237);
    console.log(`\n🚀 Testing simplified optimized vote account discovery (Proposal ID=${id})...`);
    const voteAccounts = await getProposalVoteAccountsSimpleOptimized(id);

    console.log("✅ Simplified optimization solution test successful!");
    console.log(`📋 Found vote accounts: ${voteAccounts.length}`);

    if (voteAccounts.length > 0) {
      console.log("📋 Vote account list:");
      voteAccounts.forEach((acc, index) => {
        console.log(`   ${index + 1}. ${acc.pubkey.toString()}`);
      });

      console.log(`\n🔧 Format for remainingAccounts:`);
      console.log(
        `   ${voteAccounts.length} vote accounts ready for proposal finalization transaction`
      );
    } else {
      console.log("ℹ️ This proposal has no voting records yet");
    }
  } catch (e: any) {
    console.error("❌ Simplified optimization solution test failed:", e.message || e);
  }
}

/**
 * Usage example: Replace hardcoded vote account logic
 *
 * Original hardcoded approach:
 * ```typescript
 * // ❌ Hardcoded approach - requires predefined voter list
 * const voteAccounts = [];
 * for (const vote of scenario.votes) {
 *   const [votePda] = PublicKey.findProgramAddressSync([
 *     Buffer.from("vote"),
 *     proposalId.toArrayLike(Buffer, "le", 8),
 *     vote.member.publicKey.toBuffer(),
 *   ], programId);
 *   voteAccounts.push({ pubkey: votePda, isWritable: false, isSigner: false });
 * }
 * ```
 *
 * Simplified optimization approach:
 * ```typescript
 * // ✅ Simplified optimization approach - automatically discover all vote accounts
 * import { getProposalVoteAccountsSimpleOptimized } from './governance-queries.devnet';
 *
 * const voteAccounts = await getProposalVoteAccountsSimpleOptimized(proposalId);
 *
 * // Build remainingAccounts
 * const allRemainingAccounts = [...memberTokenAccounts, ...voteAccounts];
 *
 * // Use for proposal finalization
 * const finalizeProposalTx = await program.methods
 *   .finalizeProposal(proposalId)
 *   .accounts({ ...accountConfig })
 *   .remainingAccounts(allRemainingAccounts)
 *   .rpc();
 * ```
 *
 * Core advantages:
 * - ✅ No cache state management, simple implementation
 * - ✅ PDA-based construction, avoids full scanning
 * - ✅ Batch query optimization, reduces network IO
 * - ✅ Automatically discovers all vote accounts, no manual maintenance needed
 * - ✅ Return format compatible with existing remainingAccounts logic
 * - ✅ Complexity optimized from O(n) to O(m), where m = committee member count
 */

if (require.main === module) {
  main().catch((e) => {
    console.error("❌ Unhandled exception:", e.message || e);
    process.exit(1);
  });
}
