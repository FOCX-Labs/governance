import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Governance } from "../target/types/governance";
import { PublicKey, Connection } from "@solana/web3.js";
import { queryVotingPowerOnChain, VotingPowerResult } from "./voting-query-onchain";

/**
 * Voting Query Tool - Pure client-side implementation, no signature required
 * Query current proposal voting status and participation rate
 */

// Environment configuration
const ENVIRONMENTS = {
  devnet: {
    rpcUrl: process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com",
    timeout: 120000,
    stepDelay: 1000,
  },
  local: {
    rpcUrl: "http://localhost:8899",
    timeout: 60000,
    stepDelay: 500,
  },
};

// Get program ID
function getProgramId(): PublicKey {
  return new PublicKey("9GqiBXHh7e5gREwHU6PKHDaQsLuYfqHQ2az2sBLXdaTv");
}

/**
 * Client-side calculation of voting power and statistics
 * This is a signature-free pure query implementation
 */
async function calculateVotingPowerClientSide(
  connection: Connection,
  program: any,
  programId: PublicKey,
  proposalId: number
): Promise<{ totalVotingPower: number; voteStats: any } | null> {
  console.log("🔍 Using client-side voting power calculation...");

  try {
    // Calculate PDAs
    const [governanceConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_config")],
      programId
    );

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), new anchor.BN(proposalId).toArrayLike(Buffer, "le", 8)],
      programId
    );

    console.log("📋 Getting on-chain data:");
    console.log(`   • Governance Config PDA: ${governanceConfigPda.toString()}`);
    console.log(`   • Proposal PDA: ${proposalPda.toString()}`);

    // Get governance configuration and proposal data
    const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
    const proposal = await program.account.proposal.fetch(proposalPda);
    const committeeTokenMint = governanceConfig.committeeTokenMint;

    console.log(`   • Committee Token Mint: ${committeeTokenMint.toString()}`);

    // Get token mint information
    const mintInfo = await connection.getAccountInfo(committeeTokenMint);
    if (!mintInfo) {
      console.log("❌ Unable to get committee token mint information");
      return null;
    }
    const decimals = mintInfo.data[44]; // Token mint decimals at byte 44

    console.log("🔍 Calculating committee member voting power...");
    let totalVotingPower = 0;

    // Calculate voting power for each committee member
    for (let i = 0; i < governanceConfig.committeeMemberCount; i++) {
      const memberPubkey = governanceConfig.committeeMembers[i];
      if (!memberPubkey) continue;

      try {
        const tokenAccounts = await connection.getTokenAccountsByOwner(memberPubkey, {
          mint: committeeTokenMint,
        });

        for (const tokenAccount of tokenAccounts.value) {
          const accountInfo = await connection.getAccountInfo(tokenAccount.pubkey);
          if (accountInfo) {
            // Token account amount is at bytes 64-72
            const amountBytes = accountInfo.data.slice(64, 72);
            const amount = new anchor.BN(amountBytes, "le").toNumber();
            const votingPower = Math.floor(amount / Math.pow(10, decimals));
            totalVotingPower += votingPower;
          }
        }
        console.log(`   ✅ Member ${i + 1}: Voting power calculated`);
      } catch (error) {
        console.log(`   ⚠️ Member ${i + 1}: Unable to get token balance`);
      }
    }

    console.log(`📊 Calculation results:`);
    console.log(`   • Total voting power: ${totalVotingPower}`);
    console.log(
      `   • Current voting statistics: Yes${proposal.yesVotes.toNumber()} | No${proposal.noVotes.toNumber()} | Abstain${proposal.abstainVotes.toNumber()} | Veto${proposal.vetoVotes.toNumber()}`
    );

    return {
      totalVotingPower,
      voteStats: {
        yesVotes: proposal.yesVotes.toNumber(),
        noVotes: proposal.noVotes.toNumber(),
        abstainVotes: proposal.abstainVotes.toNumber(),
        vetoVotes: proposal.vetoVotes.toNumber(),
        totalVotes: proposal.totalVotes.toNumber(),
      },
    };
  } catch (error) {
    console.log(`❌ Client-side calculation failed: ${error.message}`);
    return null;
  }
}

/**
 * Query voting status for a single proposal
 */
async function queryProposalVoting(proposalId: number, isLocal: boolean = false) {
  const env = isLocal ? ENVIRONMENTS.local : ENVIRONMENTS.devnet;
  const connection = new Connection(env.rpcUrl, "confirmed");
  const programId = getProgramId();

  console.log("🔍 Voting Query Tool");
  console.log("═".repeat(50));
  console.log(`🌐 Network Environment: ${isLocal ? "Local" : "Devnet"}`);
  console.log(`🏛️ Program ID: ${programId.toString()}`);
  console.log(`🎯 Query Proposal ID: ${proposalId}`);

  // Calculate PDAs
  const [governanceConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("governance_config")],
    programId
  );

  const [proposalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal"), new anchor.BN(proposalId).toArrayLike(Buffer, "le", 8)],
    programId
  );

  console.log(`📋 Governance Config PDA: ${governanceConfigPda.toString()}`);
  console.log(`📋 Proposal PDA: ${proposalPda.toString()}`);

  try {
    // Use existing authority wallet (with SOL balance)
    const fs = require("fs");
    const authorityKeypairData = JSON.parse(fs.readFileSync("keys/authority.json", "utf8"));
    const authorityKeypair = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(authorityKeypairData)
    );

    console.log(`💰 Using authority wallet: ${authorityKeypair.publicKey.toString()}`);

    // Check balance
    const balance = await connection.getBalance(authorityKeypair.publicKey);
    console.log(`💰 Wallet balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);

    const wallet = new anchor.Wallet(authorityKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    anchor.setProvider(provider);

    // Load program
    const program = anchor.workspace.Governance as Program<Governance>;

    // Prioritize on-chain query instruction
    console.log(`\n🔍 Attempting to use on-chain query instruction...`);
    const onchainResult = await queryVotingPowerOnChain(connection, program, programId, proposalId);

    let totalVotingPower: number;
    let voteStats: any;

    if (onchainResult) {
      console.log(`✅ Using on-chain query results`);
      totalVotingPower = onchainResult.totalVotingPower;
      voteStats = {
        yes: onchainResult.yesVotes,
        no: onchainResult.noVotes,
        abstain: onchainResult.abstainVotes,
        veto: onchainResult.vetoVotes,
        total: onchainResult.totalVotes,
      };
    } else {
      console.log(`❌ On-chain query failed, terminating (client-side fallback not allowed)`);
      return;
    }

    // Get proposal and governance configuration information
    const proposal = await program.account.proposal.fetch(proposalPda);
    const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);

    const {
      yes: yesVotes,
      no: noVotes,
      abstain: abstainVotes,
      veto: vetoVotes,
      total: totalVotes,
    } = voteStats;

    console.log(`\n🎯 Proposal ${proposalId}: ${proposal.title}`);
    console.log(`   • Status: ${Object.keys(proposal.status)[0]}`);
    console.log(
      `   • Voting Statistics: Yes${yesVotes} | No${noVotes} | Abstain${abstainVotes} | Veto${vetoVotes} | Total${totalVotes}`
    );

    // Calculate participation rate
    const participationRate = totalVotingPower > 0 ? (totalVotes / totalVotingPower) * 100 : 0;
    const participationThreshold = governanceConfig.participationThreshold / 100;

    if (totalVotes > 0) {
      const approvalRate = (yesVotes / totalVotes) * 100;
      const vetoRate = (vetoVotes / totalVotes) * 100;
      console.log(
        `   • Approval Rate: ${approvalRate.toFixed(1)}% | Veto Rate: ${vetoRate.toFixed(1)}%`
      );
    }

    console.log(
      `   • Participation: ${participationRate.toFixed(1)}% (required ${participationThreshold}%) ${
        participationRate >= participationThreshold ? "✅" : "❌"
      }`
    );

    // Time information
    const currentTime = Math.floor(Date.now() / 1000);
    const votingEnd = proposal.votingEnd.toNumber();
    const timeStatus = currentTime > votingEnd ? "🔴 Ended" : "🟢 Active";
    console.log(`   • Time Status: ${timeStatus}`);

    console.log(`\n✅ Query completed`);
  } catch (error) {
    console.error("❌ Query failed:", error.message);
  }
}

/**
 * Batch query multiple proposals
 */
async function batchQueryProposals(isLocal: boolean = false) {
  console.log("🔍 Batch querying proposal voting status");
  console.log("═".repeat(50));

  // Query proposal IDs 192-196
  const proposalIds = [192, 193, 194, 195, 196];

  for (const proposalId of proposalIds) {
    try {
      await queryProposalVoting(proposalId, isLocal);
      console.log(""); // Empty line separator
    } catch (error) {
      console.log(`❌ Proposal ${proposalId} query failed: ${error.message}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes("--local");
  const isBatch = args.includes("--batch");

  if (isBatch) {
    await batchQueryProposals(isLocal);
  } else {
    const proposalId = parseInt(args[0]);
    if (isNaN(proposalId)) {
      console.log("❌ Please provide a valid proposal ID");
      console.log("Usage: ts-node scripts/voting-query.ts <proposal_id> [--local]");
      console.log("Batch query: ts-node scripts/voting-query.ts --batch [--local]");
      return;
    }
    await queryProposalVoting(proposalId, isLocal);
  }
}

// Run main function
if (require.main === module) {
  main().catch(console.error);
}
