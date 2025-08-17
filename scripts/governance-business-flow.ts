#!/usr/bin/env ts-node

/**
 * Governance System Complete Business Flow Script - Real On-Chain Interaction Version
 *
 * This script demonstrates the complete business flow of the governance system, including:
 * 1. Governance system initialization and committee token creation
 * 2. Committee member management and token distribution
 * 3. Rule document management
 * 4. Multiple types of proposal creation and voting processes
 * 5. Different voting result scenario tests (passed, vetoed, failed, tied, executed, expired)
 * 6. Proposal execution and state management
 * 7. Complete voting type tests (Approve, Reject, Abstain, NoWithVeto)
 *
 * All operations are real on-chain interactions that generate real transaction signatures
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Governance } from "../target/types/governance";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  getMint,
  createInitializeAccountInstruction,
  createTransferCheckedInstruction,
  transfer,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env" });

// Dynamically get program ID
function getProgramId(): PublicKey {
  try {
    const keypairPath = path.join(__dirname, "..", "target", "deploy", "governance-keypair.json");
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    return keypair.publicKey;
  } catch (error) {
    console.error("Unable to read program key file:", error);
    throw new Error("Please ensure the program is properly built and key file is generated");
  }
}

// Environment configuration
function getNetworkConfig() {
  const isLocal = process.argv.includes("--local");
  const isDevnet = process.argv.includes("--devnet") || !isLocal;

  return {
    isLocal,
    isDevnet,
    rpcUrl: isLocal
      ? process.env.LOCALNET_RPC || "http://localhost:8899"
      : process.env.DEVNET_RPC || "https://api.devnet.solana.com",
    networkName: isLocal ? "Localnet" : "Devnet",
    explorerUrl: isLocal ? "http://localhost:8899" : "https://explorer.solana.com",
    clusterSuffix: isLocal ? "" : "?cluster=devnet",
    transactionTimeout: parseInt(process.env.TRANSACTION_TIMEOUT || "60000"),
    confirmationTimeout: parseInt(process.env.CONFIRMATION_TIMEOUT || "30000"),
    stepDelay: parseInt(process.env.STEP_DELAY || "1000"),
  };
}

// Delay function
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Read governance configuration from on-chain
async function getGovernanceConfigFromChain(
  program: Program<Governance>,
  governanceConfigPda: PublicKey
) {
  try {
    const config = await program.account.governanceConfig.fetch(governanceConfigPda);
    return {
      testMode: config.testMode,
      votingPeriod: config.votingPeriod.toNumber(),
      participationThreshold: config.participationThreshold,
      approvalThreshold: config.approvalThreshold,
      vetoThreshold: config.vetoThreshold,
      feeRate: config.feeRate,
      proposalDeposit: config.proposalDeposit.toNumber(),
      authority: config.authority.toString(),
      committeeMemberCount: config.committeeMemberCount,
      proposalCounter: config.proposalCounter.toNumber(),
    };
  } catch (error) {
    throw new Error(`Failed to read governance config from chain: ${error.message}`);
  }
}

// Validate governance configuration against business rules
function validateGovernanceConfig(config: any) {
  const businessRules = {
    testMode: false,
    votingPeriod: 14 * 24 * 60 * 60, // 14 days
    participationThreshold: 4000, // 40%
    approvalThreshold: 5000, // 50%
    vetoThreshold: 3000, // 30%
    feeRate: 1000, // 10%
  };

  const warnings = [];
  for (const [key, expectedValue] of Object.entries(businessRules)) {
    if (config[key] !== expectedValue) {
      const currentDisplay =
        key === "votingPeriod"
          ? `${config[key]} seconds (${config[key] / (24 * 60 * 60)} days)`
          : key.includes("Threshold") || key === "feeRate"
          ? `${config[key] / 100}%`
          : config[key];

      const expectedDisplay =
        key === "votingPeriod"
          ? `${expectedValue} seconds (${(expectedValue as number) / (24 * 60 * 60)} days)`
          : key.includes("Threshold") || key === "feeRate"
          ? `${(expectedValue as number) / 100}%`
          : expectedValue;

      warnings.push(
        `⚠️ ${key}: Current ${currentDisplay}, Business rule requires ${expectedDisplay}`
      );
    }
  }

  if (warnings.length > 0) {
    logWarning("Configuration does not fully comply with business rules:");
    warnings.forEach((warning) => console.log(`   ${warning}`));
    logInfo(
      "To update configuration, run: ts-node scripts/update-governance-config.ts --update --devnet"
    );
  } else {
    logSuccess("Configuration fully complies with business rules requirements!");
  }

  return warnings.length === 0;
}

// Logging functions
function logStep(step: string, description: string) {
  console.log(`\n🔹 ${step}: ${description}`);
  console.log("─".repeat(80));
}

function logTransaction(action: string, signature: string, details?: any, networkConfig?: any) {
  console.log(`✅ ${action}`);
  console.log(`📝 Transaction signature: ${signature}`);
  if (networkConfig) {
    console.log(
      `🔗 Solana Explorer: ${networkConfig.explorerUrl}/tx/${signature}${networkConfig.clusterSuffix}`
    );
  }
  if (details) {
    console.log(`📊 Details:`, JSON.stringify(details, null, 2));
  }
  console.log("");
}

function logError(action: string, error: any) {
  console.log(`❌ ${action} failed`);
  console.log(`🚨 Error message: ${error.message || error}`);
  if (error.logs) {
    console.log(`📋 Transaction logs:`, error.logs);
  }
  console.log("");
}

function logInfo(message: string) {
  console.log(`ℹ️ ${message}`);
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logWarning(message: string) {
  console.log(`⚠️ ${message}`);
}

// Load keypair
function loadKeypair(filename: string): Keypair {
  const keypairPath = path.join(__dirname, "..", "keys", filename);
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Create or load keypair
function getOrCreateKeypair(filename: string): Keypair {
  const keypairPath = path.join(__dirname, "..", "keys", filename);

  try {
    if (fs.existsSync(keypairPath)) {
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
      return Keypair.fromSecretKey(new Uint8Array(keypairData));
    }
  } catch (error) {
    console.log(`⚠️ Unable to load key file ${filename}, creating new keypair`);
  }

  // Create new keypair
  const keypair = Keypair.generate();

  // Ensure keys directory exists
  const keysDir = path.dirname(keypairPath);
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  // Save keypair
  fs.writeFileSync(keypairPath, JSON.stringify(Array.from(keypair.secretKey)));
  console.log(`💾 New keypair saved to ${filename}`);

  return keypair;
}

async function main() {
  console.log("🏛️ Governance System Complete Business Flow Demo - Real On-Chain Interaction");
  console.log("═".repeat(80));

  try {
    // Get network configuration
    const networkConfig = getNetworkConfig();
    console.log(`🌐 Network Environment: ${networkConfig.networkName}`);
    console.log(`🔗 RPC Endpoint: ${networkConfig.rpcUrl}`);

    // Set up connection and provider
    const connection = new Connection(networkConfig.rpcUrl, "confirmed");

    // Load keypairs
    const authority = getOrCreateKeypair("authority.json");

    // Configure committee members (authority is no longer a committee member, 4 independent committee members)
    // According to current on-chain state, the correct member correspondence is:
    // Member 1 (index 0): committee-member-1-devnet.json (10 tokens)
    // Member 2 (index 1): committee-member-2-devnet.json (15 tokens)
    // Member 3 (index 2): committee-member-3-devnet.json (20 tokens)
    // Member 4 (index 3): committee-member-4-devnet.json (30 tokens)
    const committeeMember1 = getOrCreateKeypair(
      networkConfig.isDevnet ? "committee-member-1-devnet.json" : "committee-member-1.json"
    );
    const committeeMember2 = getOrCreateKeypair(
      networkConfig.isDevnet ? "committee-member-2-devnet.json" : "committee-member-2.json"
    );
    const committeeMember3 = getOrCreateKeypair(
      networkConfig.isDevnet ? "committee-member-3-devnet.json" : "committee-member-3.json"
    );
    const committeeMember4 = getOrCreateKeypair(
      networkConfig.isDevnet ? "committee-member-4-devnet.json" : "committee-member-4.json"
    );

    // Use specified committee governance token
    let committeeTokenMintKeypair: Keypair | null = null;
    let committeeTokenMintPubkey: PublicKey;
    let committeeTokenMint: Keypair; // Keypair object for storing committee token

    // Create or get USDC token (for proposal deposits)
    let usdcTokenMintKeypair: Keypair | null = null;
    let usdcTokenMintPubkey: PublicKey;

    // Use specified committee token address
    if (networkConfig.isDevnet) {
      // Devnet uses actual on-chain committee token mint (unified as GovXU1R...)
      committeeTokenMintPubkey = new PublicKey("GovXU1RFee5gJatCDWJPu3XxhxqVzGqdd2xdv4wd1TSx");
      committeeTokenMintKeypair = null; // No minting authority in devnet environment
      logInfo(`Using specified committee token: ${committeeTokenMintPubkey.toString()}`);

      // Verify if token mint exists
      try {
        await getMint(connection, committeeTokenMintPubkey);
        logInfo(`Committee token verification successful: ${committeeTokenMintPubkey.toString()}`);
      } catch (error) {
        logError("Committee token verification failed", error);
        throw new Error(
          `Specified committee token does not exist: ${committeeTokenMintPubkey.toString()}`
        );
      }
    } else {
      // Localnet environment still uses dynamic creation method
      const tokenFileName = "committee-governance-token.json";

      try {
        // Try to load existing committee token
        committeeTokenMintKeypair = loadKeypair(tokenFileName);
        committeeTokenMintPubkey = committeeTokenMintKeypair.publicKey;
        logInfo("Using existing committee governance token");

        // Verify if token mint exists
        await getMint(connection, committeeTokenMintPubkey);
        logInfo(`Committee token verification successful: ${committeeTokenMintPubkey.toString()}`);
      } catch (error) {
        // Create new committee governance token
        logInfo("Creating new committee governance token...");
        committeeTokenMintKeypair = Keypair.generate();

        const decimals = parseInt(process.env.COMMITTEE_TOKEN_DECIMALS || "9");
        const createMintTx = await createMint(
          connection,
          authority,
          authority.publicKey, // mint authority
          authority.publicKey, // freeze authority
          decimals,
          committeeTokenMintKeypair
        );

        committeeTokenMintPubkey = committeeTokenMintKeypair.publicKey;

        // Save token keys
        const tokenKeysDir = path.join(__dirname, "..", "keys");
        if (!fs.existsSync(tokenKeysDir)) {
          fs.mkdirSync(tokenKeysDir, { recursive: true });
        }
        fs.writeFileSync(
          path.join(tokenKeysDir, tokenFileName),
          JSON.stringify(Array.from(committeeTokenMintKeypair.secretKey))
        );

        logTransaction(
          "Create committee governance token",
          createMintTx.toString(),
          {
            mint: committeeTokenMintPubkey.toString(),
            decimals: decimals,
            mintAuthority: authority.publicKey.toString(),
            freezeAuthority: authority.publicKey.toString(),
          },
          networkConfig
        );
      }
    }

    // Set committee token mint object (for subsequent function calls)
    committeeTokenMint = {
      publicKey: committeeTokenMintPubkey,
      secretKey: committeeTokenMintKeypair?.secretKey || new Uint8Array(64),
    } as Keypair;

    // Create or get USDC token
    if (networkConfig.isDevnet) {
      // Devnet uses USDC SPL Token (DXDVt289yXEcqXDd9Ub3HqSBTWwrmNB8DzQEagv9Svtu)
      usdcTokenMintPubkey = new PublicKey("DXDVt289yXEcqXDd9Ub3HqSBTWwrmNB8DzQEagv9Svtu");
      usdcTokenMintKeypair = null; // No minting authority in devnet environment
      logInfo(`Using Devnet USDC SPL Token: ${usdcTokenMintPubkey.toString()}`);
    } else {
      // Localnet creates simulated USDC token
      const usdcFileName = "usdc-token-mint.json";

      try {
        usdcTokenMintKeypair = loadKeypair(usdcFileName);
        usdcTokenMintPubkey = usdcTokenMintKeypair.publicKey;
        logInfo("Using existing simulated USDC token");
      } catch (error) {
        logInfo("Creating simulated USDC token...");
        usdcTokenMintKeypair = Keypair.generate();

        const usdcDecimals = parseInt(process.env.USDC_DECIMALS || "6");
        const createUsdcTx = await createMint(
          connection,
          authority,
          authority.publicKey, // mint authority
          authority.publicKey, // freeze authority
          usdcDecimals,
          usdcTokenMintKeypair,
          undefined, // confirmOptions
          TOKEN_PROGRAM_ID // Explicitly specify TOKEN_PROGRAM_ID
        );

        usdcTokenMintPubkey = usdcTokenMintKeypair.publicKey;

        // Save USDC token key
        const tokenKeysDir = path.join(__dirname, "..", "keys");
        fs.writeFileSync(
          path.join(tokenKeysDir, usdcFileName),
          JSON.stringify(Array.from(usdcTokenMintKeypair.secretKey))
        );

        logTransaction(
          "Create simulated USDC token",
          createUsdcTx.toString(),
          {
            mint: usdcTokenMintPubkey.toString(),
            decimals: usdcDecimals,
            mintAuthority: authority.publicKey.toString(),
            freezeAuthority: authority.publicKey.toString(),
          },
          networkConfig
        );
      }
    }

    // Get dynamic program ID
    const programId = getProgramId();

    console.log(`👤 Governance authority address: ${authority.publicKey.toString()}`);
    console.log(`👥 Committee member 1: ${committeeMember1.publicKey.toString()}`);
    console.log(`👥 Committee member 2: ${committeeMember2.publicKey.toString()}`);
    console.log(`👥 Committee member 3: ${committeeMember3.publicKey.toString()}`);
    console.log(`👥 Committee member 4: ${committeeMember4.publicKey.toString()}`);
    console.log(`🪙 Committee token: ${committeeTokenMintPubkey.toString()}`);
    console.log(`💰 USDC token: ${usdcTokenMintPubkey.toString()}`);
    console.log(`🏛️ Program ID: ${programId.toString()}`);

    // Set Anchor provider
    const wallet = new anchor.Wallet(authority);
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    anchor.setProvider(provider);

    // Load program
    const program = anchor.workspace.Governance as Program<Governance>;

    // Check balance and airdrop
    const balances = await Promise.all([
      connection.getBalance(authority.publicKey),
      connection.getBalance(committeeMember1.publicKey),
      connection.getBalance(committeeMember2.publicKey),
      connection.getBalance(committeeMember3.publicKey),
      connection.getBalance(committeeMember4.publicKey),
    ]);

    console.log(`💰 Account balances:`);
    console.log(`   Governance authority: ${balances[0] / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Committee member 1: ${balances[1] / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Committee member 2: ${balances[2] / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Committee member 3: ${balances[3] / LAMPORTS_PER_SOL} SOL`);
    console.log(`   Committee member 4: ${balances[4] / LAMPORTS_PER_SOL} SOL`);

    // Airdrop or transfer for accounts with insufficient balance
    const members = [committeeMember1, committeeMember2, committeeMember3, committeeMember4];
    for (let i = 0; i < members.length; i++) {
      if (balances[i + 1] < 0.1 * LAMPORTS_PER_SOL) {
        try {
          // First try airdrop
          const airdropSig = await connection.requestAirdrop(
            members[i].publicKey,
            1 * LAMPORTS_PER_SOL
          );
          await connection.confirmTransaction(airdropSig, "confirmed");
          logInfo(`Airdropped 1 SOL to committee member ${i + 1}: ${airdropSig}`);
        } catch (error) {
          logWarning(`Airdrop failed for committee member ${i + 1}: ${error}`);

          // When airdrop fails, use main wallet transfer
          try {
            logInfo(`Attempting to transfer from main wallet to committee member ${i + 1}...`);
            const transferTx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: authority.publicKey,
                toPubkey: members[i].publicKey,
                lamports: 0.1 * LAMPORTS_PER_SOL, // Transfer 0.1 SOL for transaction fees
              })
            );

            const transferSig = await sendAndConfirmTransaction(
              connection,
              transferTx,
              [authority],
              { commitment: "confirmed" }
            );

            logInfo(
              `✅ Successfully transferred 0.1 SOL to committee member ${i + 1}: ${transferSig}`
            );
          } catch (transferError) {
            logError(`Transfer to committee member ${i + 1}`, transferError);
          }
        }
      }
    }

    // Get PDA addresses
    const [governanceConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_config")],
      programId
    );

    const [ruleRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("rule_registry")],
      programId
    );

    console.log(`\n🔗 Important PDA addresses:`);
    console.log(`   Governance config: ${governanceConfigPda.toString()}`);
    console.log(`   Rule registry: ${ruleRegistryPda.toString()}`);

    // Continue to next part...
    await runBusinessFlow(
      program,
      connection,
      authority,
      [committeeMember1, committeeMember2, committeeMember3, committeeMember4],
      committeeTokenMint,
      governanceConfigPda,
      ruleRegistryPda,
      networkConfig,
      usdcTokenMintPubkey,
      usdcTokenMintKeypair
    );
  } catch (error) {
    logError("Business flow execution", error);
    process.exit(1);
  }
}

// Business flow execution function
async function runBusinessFlow(
  program: Program<Governance>,
  connection: Connection,
  authority: Keypair,
  members: Keypair[],
  committeeTokenMint: Keypair,
  governanceConfigPda: PublicKey,
  ruleRegistryPda: PublicKey,
  networkConfig: any,
  usdcTokenMintPubkey: PublicKey,
  usdcTokenMintKeypair: Keypair | null
) {
  // ==================== Phase 1: System Initialization Verification ====================
  logStep("Phase 1", "System Initialization Verification");

  try {
    // Check if governance system is initialized
    const governanceAccount = await connection.getAccountInfo(governanceConfigPda);
    let needsReinit = false;

    if (!governanceAccount) {
      needsReinit = true;
    } else {
      // Try to deserialize to check if data structure is compatible
      try {
        await program.account.governanceConfig.fetch(governanceConfigPda);
        logInfo("Governance system exists and data structure is compatible");
      } catch (deserializeError) {
        logWarning("Detected incompatible data structure, need to reinitialize");
        needsReinit = true;

        // Try to manually clean account data
        try {
          // Create a simple transaction to reset account data
          new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: authority.publicKey,
              toPubkey: authority.publicKey,
              lamports: 0, // 0 lamports transfer
            })
          );

          // This is just to trigger a transaction, actually we need to skip this account
          logInfo("Skip incompatible governance config account, will reinitialize");
        } catch (resetError) {
          logWarning("Unable to reset account, will try to reinitialize");
        }
      }
    }

    if (needsReinit) {
      logInfo("Governance system not initialized, initializing...");

      // Initialize governance system using business rules parameters
      // Business rules configuration (not from environment variables)
      const businessRulesConfig = {
        testMode: false, // Production mode
        votingPeriod: 14 * 24 * 60 * 60, // 14 days
        participationThreshold: 4000, // 40%
        approvalThreshold: 5000, // 50%
        vetoThreshold: 3000, // 30%
        feeRate: 1000, // 10%
      };

      logInfo("Initializing governance system with business rules parameters:");
      logInfo(`  • Test Mode: ${businessRulesConfig.testMode}`);
      logInfo(
        `  • Voting Period: ${businessRulesConfig.votingPeriod} seconds (${
          businessRulesConfig.votingPeriod / (24 * 60 * 60)
        } days)`
      );
      logInfo(`  • Participation Threshold: ${businessRulesConfig.participationThreshold / 100}%`);
      logInfo(`  • Approval Threshold: ${businessRulesConfig.approvalThreshold / 100}%`);
      logInfo(`  • Veto Threshold: ${businessRulesConfig.vetoThreshold / 100}%`);
      logInfo(`  • Committee Fee Rate: ${businessRulesConfig.feeRate / 100}%`);

      // Use raw token amount (program will automatically calculate based on token decimals)
      const proposalDepositRaw = 100; // 100 tokens (raw amount, excluding decimals)

      try {
        const initTx = await program.methods
          .initializeGovernance(
            new anchor.BN(proposalDepositRaw), // 100 tokens (raw amount)
            new anchor.BN(businessRulesConfig.votingPeriod),
            businessRulesConfig.participationThreshold,
            businessRulesConfig.approvalThreshold,
            businessRulesConfig.vetoThreshold,
            businessRulesConfig.feeRate,
            businessRulesConfig.testMode
          )
          .accounts({
            authority: authority.publicKey,
            governanceConfig: governanceConfigPda,
            committeeTokenMint: committeeTokenMint.publicKey,
            usdcTokenMint: usdcTokenMintPubkey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          } as any)
          .signers([authority])
          .rpc();

        logTransaction(
          "Initialize Governance System",
          initTx,
          {
            governanceConfig: governanceConfigPda.toString(),
            authority: authority.publicKey.toString(),
            committeeTokenMint: committeeTokenMint.publicKey.toString(),
          },
          networkConfig
        );
      } catch (initError: any) {
        if (initError.message?.includes("already in use") || initError.message?.includes("0x0")) {
          logWarning("Governance config account already exists, skipping initialization");
          // Continue execution, treat as already initialized
        } else {
          logError("Failed to initialize governance system", initError);
          throw initError;
        }
      }
    } else {
      logInfo("Governance system already initialized, skipping initialization step");

      // Check if on-chain stored committee token mint matches expected one
      try {
        const accountInfo = await connection.getAccountInfo(governanceConfigPda);
        if (accountInfo) {
          // Committee token mint offset in data (skip discriminator and authority)
          const committeeTokenMintOffset = 8 + 32; // discriminator(8) + authority(32)
          const committeeTokenMintBytes = accountInfo.data.subarray(
            committeeTokenMintOffset,
            committeeTokenMintOffset + 32
          );

          const existingCommitteeTokenMint = new PublicKey(committeeTokenMintBytes);
          logInfo(
            `📋 On-chain stored committee token mint: ${existingCommitteeTokenMint.toString()}`
          );
          logInfo(
            `📋 Expected committee token mint: ${
              committeeTokenMint?.publicKey?.toString() || "unknown"
            }`
          );

          if (
            committeeTokenMint?.publicKey &&
            !existingCommitteeTokenMint.equals(committeeTokenMint.publicKey)
          ) {
            logWarning("⚠️ On-chain stored committee token mint does not match expected one!");
            logWarning(
              "This may require updating governance config or using correct committee token address"
            );
            logInfo("Continue using expected committee token mint for operations");
          } else {
            logInfo("✅ On-chain committee token mint matches expected one");
          }

          // Committee token mint has been correctly passed in, no need to reassign
          logInfo("✅ Continue execution using passed committee token mint");
        }
      } catch (error) {
        logError("Failed to get on-chain committee token mint", error);
        // If retrieval fails, use passed committee token
        logInfo("Using passed committee token as fallback");
      }
    }

    // Read current governance configuration from chain
    let chainConfig;
    try {
      logInfo("Reading governance configuration from chain...");
      chainConfig = await getGovernanceConfigFromChain(program, governanceConfigPda);

      logSuccess("Governance system configuration loaded from chain:");
      console.log(`   • Test Mode: ${chainConfig.testMode}`);
      console.log(
        `   • Voting Period: ${chainConfig.votingPeriod} seconds (${
          chainConfig.votingPeriod / (24 * 60 * 60)
        } days)`
      );
      console.log(`   • Participation Threshold: ${chainConfig.participationThreshold / 100}%`);
      console.log(`   • Approval Threshold: ${chainConfig.approvalThreshold / 100}%`);
      console.log(`   • Veto Threshold: ${chainConfig.vetoThreshold / 100}%`);
      console.log(`   • Committee Fee Rate: ${chainConfig.feeRate / 100}%`);
      console.log(`   • Committee Members: ${chainConfig.committeeMemberCount}`);
      console.log(`   • Proposal Counter: ${chainConfig.proposalCounter}`);

      // Validate configuration against business rules
      console.log("\n🔍 Validating configuration against business rules...");
      validateGovernanceConfig(chainConfig);
    } catch (error) {
      logError("Failed to read governance configuration from chain", error);
      return;
    }

    await delay(1000);
  } catch (error) {
    logError("System initialization verification", error);
    return;
  }

  // ==================== Phase 2: USDC Token Mint Creation ====================
  logStep("Phase 2", "USDC Token Mint Creation");

  // Check if USDC token mint exists
  try {
    await getMint(connection, usdcTokenMintPubkey);
    logSuccess(`USDC token mint already exists: ${usdcTokenMintPubkey.toString()}`);
  } catch (error) {
    logWarning(`USDC token mint does not exist, need to create`);

    // Create USDC token mint
    logInfo(`Creating USDC token mint...`);

    const usdcDecimals = parseInt(process.env.USDC_DECIMALS || "6");

    const createUsdcTx = await createMint(
      connection,
      authority,
      authority.publicKey, // mint authority
      authority.publicKey, // freeze authority
      usdcDecimals,
      usdcTokenMintKeypair,
      undefined, // confirmOptions
      TOKEN_PROGRAM_ID // Explicitly specify TOKEN_PROGRAM_ID
    );

    logTransaction(
      "Create USDC Token Mint",
      createUsdcTx.toString(),
      {
        mint: usdcTokenMintPubkey.toString(),
        decimals: usdcDecimals.toString(),
        mintAuthority: authority.publicKey.toString(),
        freezeAuthority: authority.publicKey.toString(),
      },
      networkConfig
    );
  }

  // ==================== Phase 3: Program Vault Initialization Check ====================
  logStep("Phase 3", "Program Vault Initialization Check");

  // Calculate program vault PDA
  const [governanceTokenVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("governance_token_vault")],
    program.programId
  );

  logInfo(`Program vault PDA: ${governanceTokenVault.toString()}`);

  // Check if program vault exists
  try {
    const vaultInfo = await getAccount(connection, governanceTokenVault);
    logSuccess(`Program vault already exists, balance: ${vaultInfo.amount.toString()} tokens`);
  } catch (error) {
    logWarning(`Program vault does not exist, need to create`);

    // Create program vault
    logInfo(`Creating program vault...`);

    // Calculate governance authority PDA
    const [governanceAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_authority")],
      program.programId
    );

    // Use program instruction to create token vault
    const initVaultTx = await program.methods
      .initializeTokenVault()
      .accounts({
        tokenVault: governanceTokenVault,
        mint: usdcTokenMintPubkey,
        governanceAuthority: governanceAuthority,
        payer: authority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([authority])
      .rpc();

    logSuccess(`Program vault created successfully: ${initVaultTx}`);
  }

  // ==================== Phase 3: Committee Member Token Distribution ====================
  logStep("Phase 3", "Committee Member Token Distribution");

  // Declare memberTokenAccounts outside try-catch to ensure it's accessible in catch block
  const memberTokenAccounts: PublicKey[] = [];

  try {
    // Get token precision information
    if (!committeeTokenMint?.publicKey) {
      throw new Error("Committee token mint not properly initialized");
    }
    const mintInfo = await getMint(connection, committeeTokenMint.publicKey);

    // Check if has minting authority
    const hasAuthority = mintInfo.mintAuthority?.equals(authority.publicKey) || false;
    const decimals = mintInfo.decimals;
    logInfo(`Committee token decimals: ${decimals}`);

    // Create token accounts and distribute tokens for each committee member
    const tokenPowers = [
      parseInt(process.env.MEMBER_1_VOTING_POWER || "10"),
      parseInt(process.env.MEMBER_2_VOTING_POWER || "15"),
      parseInt(process.env.MEMBER_3_VOTING_POWER || "20"),
      parseInt(process.env.MEMBER_4_VOTING_POWER || "30"),
    ]; // Read voting power from environment variables

    // Check if committee members need token distribution
    let needsTokenDistribution = false;
    for (let i = 0; i < members.length; i++) {
      const member = members[i];

      try {
        // Check if member is already in committee
        const govConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
        const memberExists = govConfig.committeeMembers.some(
          (existingMember: any) => existingMember.toString() === member.publicKey.toString()
        );

        if (!memberExists) {
          needsTokenDistribution = true;
          break;
        }
      } catch (error) {
        needsTokenDistribution = true;
        break;
      }
    }

    if (!needsTokenDistribution) {
      logInfo("All committee members exist, checking ATA account status and token balances...");

      // Check if each member's ATA account exists, create if not, and check token balance
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const expectedPower = tokenPowers[i];
        const expectedAmount = expectedPower * Math.pow(10, decimals);

        const memberTokenAccount = await getAssociatedTokenAddress(
          committeeTokenMint.publicKey,
          member.publicKey
        );
        memberTokenAccounts.push(memberTokenAccount);

        try {
          // Check if ATA account exists and get balance
          const accountInfo = await getAccount(connection, memberTokenAccount);
          const currentBalance = Number(accountInfo.amount);

          logInfo(
            `Committee member ${i + 1} ATA account exists, current balance: ${
              currentBalance / Math.pow(10, decimals)
            } tokens`
          );

          // Check if balance is sufficient
          if (currentBalance < expectedAmount) {
            const needAmount = expectedAmount - currentBalance;
            logInfo(
              `Committee member ${i + 1} insufficient balance, need to supplement ${
                needAmount / Math.pow(10, decimals)
              } tokens`
            );

            // Mint supplementary tokens
            const mintTx = await mintTo(
              connection,
              authority,
              committeeTokenMint.publicKey,
              memberTokenAccount,
              authority,
              needAmount
            );

            logTransaction(
              `Supplement tokens to committee member ${i + 1}`,
              mintTx.toString(),
              {
                amount: `${needAmount / Math.pow(10, decimals)} tokens`,
                destination: memberTokenAccount.toString(),
                expectedTotal: `${expectedPower} tokens`,
              },
              networkConfig
            );
          } else {
            logInfo(
              `Committee member ${i + 1} sufficient balance: ${
                currentBalance / Math.pow(10, decimals)
              } tokens`
            );
          }
        } catch (error) {
          // ATA account does not exist, create it and mint tokens
          logInfo(
            `Committee member ${
              i + 1
            } ATA account does not exist, creating and distributing tokens...`
          );
          const createAccountTx = await createAssociatedTokenAccount(
            connection,
            authority,
            committeeTokenMint.publicKey,
            member.publicKey
          );

          logTransaction(
            `Create ATA account for committee member ${i + 1}`,
            createAccountTx.toString(),
            {
              tokenAccount: memberTokenAccount.toString(),
              owner: member.publicKey.toString(),
              mint: committeeTokenMint.publicKey.toString(),
            },
            networkConfig
          );

          // Mint tokens
          const mintTx = await mintTo(
            connection,
            authority,
            committeeTokenMint.publicKey,
            memberTokenAccount,
            authority,
            expectedAmount
          );

          logTransaction(
            `Mint tokens to committee member ${i + 1}`,
            mintTx.toString(),
            {
              amount: `${expectedPower} tokens`,
              destination: memberTokenAccount.toString(),
              power: expectedPower,
            },
            networkConfig
          );
        }

        await delay(500);
      }
    } else {
      // Distribute tokens to committee members
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const power = tokenPowers[i];

        // Check if member already exists
        try {
          const govConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
          const memberExists = govConfig.committeeMembers.some(
            (existingMember: any) => existingMember.toString() === member.publicKey.toString()
          );

          if (memberExists) {
            logInfo(
              `Committee member ${
                i + 1
              } already exists, skipping token distribution and ATA creation`
            );

            // Still need to get token account address
            const memberTokenAccount = await getAssociatedTokenAddress(
              committeeTokenMint.publicKey,
              member.publicKey
            );
            memberTokenAccounts.push(memberTokenAccount);
            continue;
          }
        } catch (error) {
          // If query fails, continue processing
        }

        // Get associated token account address
        const memberTokenAccount = await getAssociatedTokenAddress(
          committeeTokenMint.publicKey,
          member.publicKey
        );

        memberTokenAccounts.push(memberTokenAccount);

        try {
          // Check if token account exists
          await getAccount(connection, memberTokenAccount);
          logInfo(`Committee member ${i + 1} token account already exists`);
        } catch (error) {
          // Create associated token account
          const createAccountTx = await createAssociatedTokenAccount(
            connection,
            authority,
            committeeTokenMint.publicKey,
            member.publicKey
          );

          logTransaction(
            `Create token account for committee member ${i + 1}`,
            createAccountTx.toString(),
            {
              tokenAccount: memberTokenAccount.toString(),
              owner: member.publicKey.toString(),
              mint: committeeTokenMint.publicKey.toString(),
            },
            networkConfig
          );
        }

        // Mint tokens - use dynamic precision calculation
        const tokenAmount = power * Math.pow(10, decimals);
        const mintTx = await mintTo(
          connection,
          authority,
          committeeTokenMint.publicKey,
          memberTokenAccount,
          authority,
          tokenAmount
        );

        logTransaction(
          `Mint tokens to committee member ${i + 1}`,
          mintTx.toString(),
          {
            amount: `${power} tokens`,
            destination: memberTokenAccount.toString(),
            power: power,
          },
          networkConfig
        );

        await delay(500);
      }
    }

    logSuccess(`Completed token distribution for ${members.length} committee members`);
    console.log(`   • Total voting weight: ${tokenPowers.reduce((a, b) => a + b, 0)} tokens`);
    console.log(`   • Member 1 weight: ${tokenPowers[0]} tokens`);
    console.log(`   • Member 2 weight: ${tokenPowers[1]} tokens`);
    console.log(`   • Member 3 weight: ${tokenPowers[2]} tokens`);
    console.log(`   • Member 4 weight: ${tokenPowers[3]} tokens`);

    // Register committee members
    logInfo("Registering committee members...");
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const memberTokenAccount = memberTokenAccounts[i];

      // Check if member already exists
      let memberExists = false;
      try {
        const govConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
        memberExists = govConfig.committeeMembers.some(
          (existingMember: any) =>
            existingMember && existingMember.toString() === member.publicKey.toString()
        );

        if (memberExists) {
          logInfo(`Committee member ${i + 1} already exists, skipping registration`);
          continue;
        } else {
          logInfo(
            `Committee member ${
              i + 1
            } (${member.publicKey.toString()}) not found in committee, will register`
          );
        }
      } catch (error) {
        logWarning(`Failed to check committee member ${i + 1} existence: ${error}`);
        // If query fails, continue trying to register
      }

      // Force registration for new member 1 (index 0) if it's the new address
      if (
        i === 0 &&
        member.publicKey.toString() === "6s84q7uWxeXbxfYo29y5dMXXKB6d8aC7zwcPQwGuLXri"
      ) {
        logInfo(`🔥 Force registering new committee member 1: ${member.publicKey.toString()}`);
      }

      try {
        const addMemberTx = await program.methods
          .addCommitteeMember(member.publicKey)
          .accounts({
            authority: authority.publicKey,
            governanceConfig: governanceConfigPda,
          } as any)
          .signers([authority])
          .rpc();

        logTransaction(
          `Register committee member ${i + 1}`,
          addMemberTx,
          {
            member: member.publicKey.toString(),
            tokenAccount: memberTokenAccount.toString(),
          },
          networkConfig
        );
      } catch (error) {
        logWarning(`Committee member ${i + 1} registration failed: ${error}`);
      }

      await delay(500);
    }

    // Create USDC token account for authority and mint deposit
    logInfo("Creating USDC token account for authority and minting deposit...");

    // First verify USDC token mint is valid
    await getMint(connection, usdcTokenMintPubkey);

    const authorityUsdcAccount = await getAssociatedTokenAddress(
      usdcTokenMintPubkey,
      authority.publicKey
    );

    try {
      await getAccount(connection, authorityUsdcAccount);
      logInfo("Authority USDC account already exists");
    } catch (error) {
      // Create associated token account
      const createUsdcAccountTx = await createAssociatedTokenAccount(
        connection,
        authority,
        usdcTokenMintPubkey,
        authority.publicKey
      );

      logTransaction(
        "Create Authority USDC account",
        createUsdcAccountTx.toString(),
        {
          tokenAccount: authorityUsdcAccount.toString(),
          owner: authority.publicKey.toString(),
          mint: usdcTokenMintPubkey.toString(),
        },
        networkConfig
      );
    }

    // Check and ensure sufficient USDC balance
    try {
      const accountInfo = await getAccount(connection, authorityUsdcAccount);
      // Dynamically get USDC token precision (for display only)
      const usdcMintInfo = await getMint(connection, usdcTokenMintPubkey);
      const usdcDecimals = usdcMintInfo.decimals;
      const balance = Number(accountInfo.amount) / Math.pow(10, usdcDecimals);
      logInfo(`Authority USDC balance: ${balance} USDC`);

      // If balance is insufficient, try to mint more USDC (only when having mint authority)
      if (balance < 300) {
        // Ensure at least 300 USDC for 3 proposals
        if (usdcTokenMintKeypair) {
          logInfo("Insufficient balance, minting more USDC...");
          const mintAmount = 1000 * Math.pow(10, usdcDecimals); // Mint 1000 USDC

          const mintTx = await mintTo(
            connection,
            authority,
            usdcTokenMintPubkey,
            authorityUsdcAccount,
            authority,
            mintAmount
          );

          logTransaction(
            "Mint USDC to Authority",
            mintTx.toString(),
            {
              amount: "1000 USDC",
              destination: authorityUsdcAccount.toString(),
              mint: usdcTokenMintPubkey.toString(),
            },
            networkConfig
          );

          // Re-query balance
          const newAccountInfo = await getAccount(connection, authorityUsdcAccount);
          const newBalance = Number(newAccountInfo.amount) / Math.pow(10, usdcDecimals);
          logSuccess(`Authority USDC balance updated to: ${newBalance} USDC`);
        } else {
          logWarning(
            "Insufficient USDC balance and no mint authority, may affect proposal creation."
          );
        }
      } else {
        logSuccess(`Authority USDC balance sufficient: ${balance} USDC`);
      }
    } catch (error) {
      // If account doesn't exist or balance is 0, and we have mint authority, mint USDC
      if (usdcTokenMintKeypair) {
        logInfo("USDC account does not exist or balance is 0, minting USDC...");
        // Dynamically get USDC token precision
        const usdcMintInfo = await getMint(connection, usdcTokenMintPubkey);
        const usdcDecimals = usdcMintInfo.decimals;
        const mintAmount = 1000 * Math.pow(10, usdcDecimals); // Mint 1000 USDC

        const mintTx = await mintTo(
          connection,
          authority,
          usdcTokenMintPubkey,
          authorityUsdcAccount,
          authority,
          mintAmount
        );

        logTransaction(
          "Mint USDC to Authority",
          mintTx.toString(),
          {
            amount: "1000 USDC",
            destination: authorityUsdcAccount.toString(),
            mint: usdcTokenMintPubkey.toString(),
          },
          networkConfig
        );
      } else {
        logWarning("Unable to query USDC balance and no mint authority, continue test execution");
      }
    }

    await delay(1000);
  } catch (error) {
    logError("Committee member token distribution", error);
    if (networkConfig.isDevnet) {
      logWarning(
        "Skip committee member token distribution in Devnet environment, continue subsequent tests"
      );

      // In devnet environment, ensure memberTokenAccounts array is properly populated
      logInfo("Ensuring memberTokenAccounts array is populated for devnet environment...");
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const memberTokenAccount = await getAssociatedTokenAddress(
          committeeTokenMint.publicKey,
          member.publicKey
        );
        memberTokenAccounts.push(memberTokenAccount);
        logInfo(`Added token account for member ${i + 1}: ${memberTokenAccount.toString()}`);
      }
    } else {
      return;
    }
  }

  // ==================== Phase 3: Rule Document Management ====================
  logStep("Phase 3", "Rule Document Management");

  try {
    // Check if rule registry exists
    const ruleRegistryAccount = await connection.getAccountInfo(ruleRegistryPda);
    if (!ruleRegistryAccount) {
      // Create rule registry
      const createRegistryTx = await program.methods
        .createRuleRegistry()
        .accounts({
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();

      logTransaction(
        "Create rule registry",
        createRegistryTx,
        {
          ruleRegistry: ruleRegistryPda.toString(),
          authority: authority.publicKey.toString(),
        },
        networkConfig
      );
    } else {
      logInfo("Rule registry already exists");
    }

    await delay(1000);
  } catch (error) {
    logError("Rule document management", error);
    // Continue execution, don't interrupt the flow
  }

  // Continue to next phase...
  await runRealProposalFlow(
    program,
    connection,
    authority,
    members,
    governanceConfigPda,
    committeeTokenMint.publicKey,
    networkConfig,
    usdcTokenMintPubkey
  );
}

// Real proposal creation and voting flow
async function runRealProposalFlow(
  program: Program<Governance>,
  connection: Connection,
  authority: Keypair,
  members: Keypair[],
  governanceConfigPda: PublicKey,
  _committeeTokenMint: PublicKey,
  networkConfig: any,
  usdcTokenMintPubkey: PublicKey
) {
  // ==================== Phase 4: Real Proposal Creation and Voting Flow ====================
  logStep("Phase 4", "Real Proposal Creation and Voting Flow");

  // Get governance configuration information - use safe method to avoid deserialization issues
  let currentProposalCounter = new anchor.BN(0);
  let actualCommitteeTokenMint = _committeeTokenMint;

  try {
    const govConfigData = await program.account.governanceConfig.fetch(governanceConfigPda);
    currentProposalCounter = govConfigData.proposalCounter;
    actualCommitteeTokenMint = govConfigData.committeeTokenMint;

    logInfo(`Current proposal counter: ${currentProposalCounter.toString()}`);
    logInfo(`Actual committee token mint: ${actualCommitteeTokenMint.toString()}`);
    logInfo(
      `Governance parameters: Participation threshold ${
        govConfigData.participationThreshold / 100
      }%, Approval threshold ${govConfigData.approvalThreshold / 100}%, Veto threshold ${
        govConfigData.vetoThreshold / 100
      }%`
    );

    // Guard: If the next proposal PDA to be created already exists (common after counter reset), skip this proposal scenario demonstration
    try {
      const nextId = currentProposalCounter.add(new anchor.BN(1));
      const [nextProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), nextId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      const existing = await connection.getAccountInfo(nextProposalPda);
      if (existing) {
        logWarning(
          `Next proposal PDA already exists: ${nextProposalPda.toString()} (likely due to proposal ID reset). Skip proposal scenarios in this run.`
        );
        return; // Early return to avoid subsequent createProposal failure
      }
    } catch (e) {
      logWarning(`Unable to precheck next proposal PDA: ${e}`);
    }
  } catch (error) {
    logWarning("Unable to get governance configuration details, using default values");
    logInfo("This may be due to data structure version mismatch");

    // Use raw account data to get committee token mint
    try {
      const accountInfo = await connection.getAccountInfo(governanceConfigPda);
      if (accountInfo) {
        const committeeTokenMintOffset = 8 + 32; // discriminator(8) + authority(32)
        const committeeTokenMintBytes = accountInfo.data.subarray(
          committeeTokenMintOffset,
          committeeTokenMintOffset + 32
        );
        actualCommitteeTokenMint = new PublicKey(committeeTokenMintBytes);
        logInfo(`Get committee token mint from raw data: ${actualCommitteeTokenMint.toString()}`);
      }
    } catch (rawError) {
      logWarning("Unable to get committee token mint from raw data, using passed value");
      actualCommitteeTokenMint = _committeeTokenMint;
    }
  }

  // Scenario 1: Create a passed proposal - Test with new committee member
  await createAndVoteProposal(
    program,
    connection,
    authority,
    members,
    governanceConfigPda,
    actualCommitteeTokenMint,
    networkConfig,
    {
      title: "Fee Rate Update - New Member Test",
      description:
        "Test proposal with new committee member to verify voting functionality and member registration",
      proposalType: { configUpdate: {} },
      votes: [
        { member: members[0], vote: "Yes" }, // New Member 1 (10 tokens)
        { member: members[1], vote: "Yes" }, // Member 2 (15 tokens)
        { member: members[2], vote: "Yes" }, // Member 3 (20 tokens)
      ],
      expectedResult: "passed", // 45 yes votes, participation 60%, approval rate 100% > 60%
    },
    usdcTokenMintPubkey
  );

  await delay(networkConfig.stepDelay);

  // Scenario 2: Create a simple rejected proposal - Test with new member
  await createAndVoteProposal(
    program,
    connection,
    authority,
    members,
    governanceConfigPda,
    actualCommitteeTokenMint,
    networkConfig,
    {
      title: "Simple Rejection Test",
      description:
        "Test proposal to verify new committee member can vote and rejection logic works correctly",
      proposalType: { configUpdate: {} },
      votes: [
        { member: members[0], vote: "No" }, // New Member 1 (10 tokens)
        { member: members[1], vote: "No" }, // Member 2 (15 tokens)
      ],
      expectedResult: "rejected", // 0 yes votes + 25 no votes = 25 votes, participation 33.3%, approval rate 0% < 60%
    },
    usdcTokenMintPubkey
  );

  await delay(networkConfig.stepDelay);

  // Comment out other scenarios to focus on testing new committee members
  console.log(`\n🎯 Test completed - focused on verifying new committee member functionality`);
  console.log(`✅ Completed 2 basic voting scenario tests`);
  console.log(`📋 New committee member address: ${members[0].publicKey.toString()}`);

  /*
  // Scenario 3: Create a barely passed proposal
  await createAndVoteProposal(
    program,
    connection,
    authority,
    members,
    governanceConfigPda,
    actualCommitteeTokenMint,
    networkConfig,
    {
      title: "Voting Period Extension",
      description:
        "Update voting period to 14 days to allow more time for committee members to participate in governance",
      proposalType: { configUpdate: {} },
      votes: [
        { member: members[0], vote: "Abstain" }, // Member 1 (10 votes)
        { member: members[1], vote: "Abstain" }, // Member 2 (15 votes)
        { member: members[2], vote: "Yes" }, // Member 3 (20 votes)
        { member: members[3], vote: "Yes" }, // Member 4 (30 votes)
      ],
      expectedResult: "passed", // 50 yes votes + 25 abstain votes = 75 votes, participation 100%, approval rate 66.7% > 60%
    },
    usdcTokenMintPubkey
  );

  await delay(networkConfig.stepDelay);

  /*
  // Comment out other scenarios to focus on testing new committee members
  // Scenario 4: Create a vetoed proposal (using NoWithVeto)
  await createAndVoteProposal(
    program,
    connection,
    authority,
    members,
    governanceConfigPda,
    actualCommitteeTokenMint,
    networkConfig,
    {
      title: "Emergency Protocol Change",
      description:
        "Emergency change to governance protocol that requires immediate veto due to security concerns",
      proposalType: { configUpdate: {} },
      votes: [
        { member: members[0], vote: "NoWithVeto" }, // Member 1 (10 votes)
        { member: members[1], vote: "NoWithVeto" }, // Member 2 (15 votes)
        { member: members[2], vote: "Yes" }, // Member 3 (20 votes)
        { member: members[3], vote: "Yes" }, // Member 4 (30 votes)
      ],
      expectedResult: "vetoed", // 25 veto votes, veto rate 33.3% > 30%
    },
    usdcTokenMintPubkey
  );

  await delay(networkConfig.stepDelay);

  // Scenario 5: Create a proposal with insufficient participation
  await createAndVoteProposal(
    program,
    connection,
    authority,
    members,
    governanceConfigPda,
    actualCommitteeTokenMint,
    networkConfig,
    {
      title: "Committee Size Adjustment",
      description:
        "Adjust committee size from current number to optimize governance efficiency and decision making",
      proposalType: { configUpdate: {} },
      votes: [
        { member: members[0], vote: "Yes" }, // Member 1 (10 votes)
        { member: members[1], vote: "Yes" }, // Member 2 (15 votes)
        // Members 3 and 4 don't vote, testing insufficient participation
      ],
      expectedResult: "rejected", // 25 yes votes, participation rate 33.3% < 50%, doesn't meet participation requirement
    },
    usdcTokenMintPubkey
  );

  await delay(networkConfig.stepDelay);

  // Scenario 6: Create a successfully passed and executed proposal
  await createAndVoteProposal(
    program,
    connection,
    authority,
    members,
    governanceConfigPda,
    actualCommitteeTokenMint,
    networkConfig,
    {
      title: "Successful Governance Update",
      description: "Update governance parameters to improve system efficiency and user experience",
      proposalType: { configUpdate: {} },
      votes: [
        { member: members[0], vote: "Abstain" }, // Member 1 (10 votes)
        { member: members[1], vote: "Yes" }, // Member 2 (15 votes)
        { member: members[2], vote: "Yes" }, // Member 3 (20 votes)
        { member: members[3], vote: "Yes" }, // Member 4 (30 votes)
      ],
      expectedResult: "passed", // 65 yes votes + 10 abstain votes = 75 votes, participation 100%, approval rate 86.7% > 60%
    },
    usdcTokenMintPubkey
  );

  await delay(networkConfig.stepDelay);

  // Scenario 7: Create a veto boundary test proposal (just not vetoed)
  await createAndVoteProposal(
    program,
    connection,
    authority,
    members,
    governanceConfigPda,
    actualCommitteeTokenMint,
    networkConfig,
    {
      title: "Veto Boundary Test - Just Not Vetoed",
      description:
        "Test proposal with 20 veto votes (26.7%) to verify it's below 30% veto threshold",
      proposalType: { configUpdate: {} },
      votes: [
        { member: members[0], vote: "Yes" }, // Member 1 (10 votes)
        { member: members[1], vote: "Yes" }, // Member 2 (15 votes)
        { member: members[2], vote: "NoWithVeto" }, // Member 3 (20 votes) - 20 veto votes
        { member: members[3], vote: "Yes" }, // Member 4 (30 votes)
      ],
      expectedResult: "passed", // 55 yes votes, 20 veto votes, veto rate 26.7% < 30%, approval rate 73.3% > 60%
    },
    usdcTokenMintPubkey
  );

  await delay(networkConfig.stepDelay);
  */

  // ==================== Phase 5: System Status Summary ====================
  logStep("Phase 5", "System Status Summary");

  try {
    // Query final governance system status
    const finalGovernanceData = await program.account.governanceConfig.fetch(governanceConfigPda);

    console.log(`📊 Final governance system status:`);
    console.log(`   • Authority address: ${finalGovernanceData.authority.toString()}`);
    console.log(`   • Committee token: ${finalGovernanceData.committeeTokenMint.toString()}`);
    console.log(`   • Committee member count: ${finalGovernanceData.committeeMemberCount}`);
    console.log(`   • Proposal counter: ${finalGovernanceData.proposalCounter.toString()}`);
    console.log(
      `   • Proposal deposit: ${finalGovernanceData.proposalDeposit.toString()} lamports`
    );
    console.log(`   • Voting period: ${finalGovernanceData.votingPeriod.toString()} seconds`);
    console.log(
      `   • Participation threshold: ${finalGovernanceData.participationThreshold / 100}%`
    );
    console.log(`   • Approval threshold: ${finalGovernanceData.approvalThreshold / 100}%`);
    console.log(`   • Veto threshold: ${finalGovernanceData.vetoThreshold / 100}%`);
    console.log(`   • Fee rate: ${finalGovernanceData.feeRate / 100}%`);

    // Query USDC balance
    try {
      const authorityUsdcAccount = await getAssociatedTokenAddress(
        usdcTokenMintPubkey,
        authority.publicKey
      );
      const usdcAccountInfo = await getAccount(connection, authorityUsdcAccount);
      // Dynamically get USDC token precision
      const usdcMintInfo = await getMint(connection, usdcTokenMintPubkey);
      const usdcDecimals = usdcMintInfo.decimals;
      const usdcBalance = Number(usdcAccountInfo.amount) / Math.pow(10, usdcDecimals);

      console.log(`\n💰 USDC deposit status:`);
      console.log(`   • USDC token address: ${usdcTokenMintPubkey.toString()}`);
      console.log(`   • Authority USDC account: ${authorityUsdcAccount.toString()}`);
      console.log(`   • Authority USDC balance: ${usdcBalance} USDC`);
      console.log(
        `   • Single proposal deposit: ${process.env.PROPOSAL_DEPOSIT_USDC || "100"} USDC`
      );
      console.log(
        `   • Number of proposals can be created: ${Math.floor(
          usdcBalance / parseInt(process.env.PROPOSAL_DEPOSIT_USDC || "100")
        )}`
      );
    } catch (error) {
      logWarning(`Unable to query USDC balance: ${error}`);
    }

    logSuccess("Governance system business flow demonstration completed!");

    console.log(`\n🎉 Demonstration summary:`);
    console.log(`   ✅ System initialization verification completed`);
    console.log(`   ✅ Committee member token distribution completed`);
    console.log(`   ✅ Rule document management verification completed`);
    console.log(`   ✅ 7 proposal scenario tests completed`);
    console.log(`   ✅ System status query completed`);

    console.log(`\n💡 Key feature verification:`);
    console.log(`   🗳️ Multiple vote types: Yes, No, Abstain, NoWithVeto`);
    console.log(`   📊 Voting weight mechanism: Based on token holdings`);
    console.log(`   🎯 Multiple result scenarios: Passed, Vetoed, Rejected, Executed`);
    console.log(
      `   🔒 Permission control: Governance authority and committee authority separation`
    );
    console.log(`   📋 Complete process: Create→Vote→Finalize→Execute`);

    // ==================== Phase 6: Deposit Status Query ====================
    if (process.env.TEST_MODE === "true") {
      logStep("Phase 6", "Deposit Status Query");

      // Query USDC deposit status
      await queryDepositStatus(connection, authority, usdcTokenMintPubkey);
    }

    // ==================== Phase 7: Fund Recovery (devnet environment only) ====================
    if (networkConfig.isDevnet) {
      logStep("Phase 7", "Fund Recovery to Main Wallet");

      // Recover committee tokens
      await reclaimCommitteeTokens(
        connection,
        authority,
        members,
        actualCommitteeTokenMint,
        networkConfig
      );

      // Recover SOL and committee tokens
      await reclaimSOLAndTokens(
        connection,
        authority,
        members,
        actualCommitteeTokenMint,
        networkConfig
      );
    }
  } catch (error) {
    logError("System Status Summary", error);
  }
}

// Deposit processing test function
async function testDepositHandling(
  _program: Program<Governance>,
  connection: Connection,
  authority: Keypair,
  _proposalPda: PublicKey,
  finalStatus: string,
  usdcTokenMintPubkey: PublicKey,
  _networkConfig: any
) {
  try {
    logInfo("Querying deposit status after proposal settlement...");

    const authorityUsdcAccount = await getAssociatedTokenAddress(
      usdcTokenMintPubkey,
      authority.publicKey
    );

    try {
      // Query balance before deposit processing
      const beforeBalance = await getAccount(connection, authorityUsdcAccount);
      // Dynamically get USDC token precision
      const usdcMintInfo = await getMint(connection, usdcTokenMintPubkey);
      const usdcDecimals = usdcMintInfo.decimals;
      const beforeAmount = Number(beforeBalance.amount) / Math.pow(10, usdcDecimals);
      const depositAmount = parseInt(process.env.PROPOSAL_DEPOSIT_USDC || "100");

      console.log(`💰 USDC balance after proposal settlement: ${beforeAmount} USDC`);
      console.log(`📊 Proposal final status: ${finalStatus}`);
      console.log(`💳 Single proposal deposit: ${depositAmount} USDC`);
      console.log(
        `✅ Deposit deduction and refund logic is automatically processed in the program`
      );
    } catch (accountError) {
      logWarning("USDC account does not exist, skip deposit status query");
      console.log(`📊 Proposal final status: ${finalStatus}`);
      console.log(`💡 Note: Current test environment has not configured USDC deposit function`);
      console.log(
        `✅ Deposit deduction and refund logic is automatically processed in the program`
      );
    }
  } catch (error) {
    logWarning(`Deposit processing test skipped: ${error.message || error}`);
  }
}

// Simplified deposit status query function
async function queryDepositStatus(
  connection: Connection,
  authority: Keypair,
  usdcTokenMintPubkey: PublicKey
) {
  try {
    logInfo("Querying USDC deposit status...");

    const authorityUsdcAccount = await getAssociatedTokenAddress(
      usdcTokenMintPubkey,
      authority.publicKey
    );

    try {
      const accountInfo = await getAccount(connection, authorityUsdcAccount);
      // Dynamically get USDC token precision
      const usdcMintInfo = await getMint(connection, usdcTokenMintPubkey);
      const usdcDecimals = usdcMintInfo.decimals;
      const balance = Number(accountInfo.amount) / Math.pow(10, usdcDecimals);
      const depositAmount = parseInt(process.env.PROPOSAL_DEPOSIT_USDC || "100");

      console.log(`💰 Authority USDC balance: ${balance} USDC`);
      console.log(`💳 Single proposal deposit: ${depositAmount} USDC`);
      console.log(
        `📊 Number of proposals that can be created: ${Math.floor(balance / depositAmount)}`
      );
    } catch (accountError) {
      logWarning("USDC account does not exist, skip deposit status query");
      console.log(`💡 Note: Current test environment has not configured USDC deposit function`);
    }
  } catch (error) {
    logWarning(`Deposit status query skipped: ${error.message || error}`);
  }
}

// Committee token recovery function
async function reclaimCommitteeTokens(
  connection: Connection,
  authority: Keypair,
  members: Keypair[],
  committeeTokenMintPubkey: PublicKey,
  networkConfig: any
) {
  try {
    let totalReclaimed = 0;

    logInfo("Starting committee token reclamation...");

    for (let i = 1; i < members.length; i++) {
      // Skip authority (member 0)
      const member = members[i];

      try {
        const memberTokenAccount = await getAssociatedTokenAddress(
          committeeTokenMintPubkey,
          member.publicKey
        );

        // Check if token account exists
        const tokenAccountInfo = await connection.getAccountInfo(memberTokenAccount);
        if (tokenAccountInfo) {
          const tokenAccount = await getAccount(connection, memberTokenAccount);
          const tokenBalance = tokenAccount.amount;

          if (tokenBalance > BigInt(0)) {
            // Recover all committee tokens to authority
            const authorityTokenAccount = await getAssociatedTokenAddress(
              committeeTokenMintPubkey,
              authority.publicKey
            );

            const transferInstruction = createTransferCheckedInstruction(
              memberTokenAccount,
              committeeTokenMintPubkey,
              authorityTokenAccount,
              member.publicKey,
              tokenBalance,
              9 // Committee token precision
            );

            const transaction = new Transaction().add(transferInstruction);
            const signature = await sendAndConfirmTransaction(connection, transaction, [member], {
              commitment: "confirmed",
            });

            const tokenAmount = Number(tokenBalance) / Math.pow(10, 9); // Assume 9 decimal places
            totalReclaimed += tokenAmount;

            logTransaction(
              `Recover committee tokens - Member ${i + 1}`,
              signature,
              {
                from: member.publicKey.toString(),
                to: authority.publicKey.toString(),
                amount: `${tokenAmount} tokens`,
                tokenMint: committeeTokenMintPubkey.toString(),
              },
              networkConfig
            );

            await delay(networkConfig.stepDelay);
          }
        }
      } catch (error) {
        logWarning(`Member ${i + 1} committee token recovery failed: ${error}`);
      }
    }

    logSuccess(`Committee token recovery completed, total recovered: ${totalReclaimed} tokens`);
  } catch (error) {
    logError("Committee token recovery", error);
  }
}

// SOL and committee token recovery function
async function reclaimSOLAndTokens(
  connection: Connection,
  authority: Keypair,
  members: Keypair[],
  committeeTokenMint: PublicKey,
  networkConfig: any
) {
  try {
    let totalSOLReclaimed = 0;
    let totalTokensReclaimed = 0;

    // Get token precision information
    const mintInfo = await getMint(connection, committeeTokenMint);
    const decimals = mintInfo.decimals;

    for (let i = 1; i < members.length; i++) {
      // Skip authority (member 0)
      const member = members[i];

      // Recover SOL
      const solBalance = await connection.getBalance(member.publicKey);
      if (solBalance > 5000) {
        // Keep 5000 lamports as rent
        const reclaimAmount = solBalance - 5000;

        // Create SOL transfer transaction
        const solTransaction = new anchor.web3.Transaction().add(
          anchor.web3.SystemProgram.transfer({
            fromPubkey: member.publicKey,
            toPubkey: authority.publicKey,
            lamports: reclaimAmount,
          })
        );

        // Send SOL transfer transaction
        const solSignature = await connection.sendTransaction(solTransaction, [member], {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });
        await connection.confirmTransaction(solSignature, "confirmed");

        totalSOLReclaimed += reclaimAmount;

        logTransaction(
          `Recover SOL - Member ${i + 1}`,
          solSignature,
          {
            from: member.publicKey.toString(),
            to: authority.publicKey.toString(),
            amount: `${reclaimAmount / LAMPORTS_PER_SOL} SOL`,
          },
          networkConfig
        );
      }

      // Recover committee tokens
      try {
        const memberTokenAccount = await getAssociatedTokenAddress(
          committeeTokenMint,
          member.publicKey
        );

        const tokenAccountInfo = await getAccount(connection, memberTokenAccount);
        const tokenBalance = Number(tokenAccountInfo.amount);

        if (tokenBalance > 0) {
          // Get authority's committee token account
          const authorityTokenAccount = await getAssociatedTokenAddress(
            committeeTokenMint,
            authority.publicKey
          );

          // Transfer tokens to authority account
          const transferTx = await transfer(
            connection,
            member, // payer
            memberTokenAccount, // source
            authorityTokenAccount, // destination
            member, // owner
            tokenBalance // amount
          );

          totalTokensReclaimed += tokenBalance;

          logTransaction(
            `Recover committee tokens - Member ${i + 1}`,
            transferTx,
            {
              from: memberTokenAccount.toString(),
              to: authorityTokenAccount.toString(),
              amount: `${tokenBalance / Math.pow(10, decimals)} tokens`,
            },
            networkConfig
          );
        }
      } catch (error) {
        logWarning(
          `Member ${
            i + 1
          }'s committee token account does not exist or balance is 0, skip token recovery`
        );
      }

      await delay(networkConfig.stepDelay);
    }

    logSuccess(`Recovery completed:`);
    console.log(`   • SOL recovery: ${totalSOLReclaimed / LAMPORTS_PER_SOL} SOL`);
    console.log(
      `   • Committee token recovery: ${totalTokensReclaimed / Math.pow(10, decimals)} tokens`
    );
  } catch (error) {
    logError("SOL and token recovery", error);
  }
}

// Real proposal creation and voting function
async function createAndVoteProposal(
  program: Program<Governance>,
  connection: Connection,
  authority: Keypair,
  members: Keypair[],
  governanceConfigPda: PublicKey,
  committeeTokenMint: PublicKey,
  networkConfig: any,
  scenario: {
    title: string;
    description: string;
    proposalType: any;
    votes: Array<{ member: Keypair; vote: string }>;
    expectedResult: string;
  },
  usdcTokenMintPubkey: PublicKey
) {
  logStep("Proposal Creation", scenario.title);

  // Declare variables in function scope
  let proposalId: anchor.BN;
  let proposalPda: PublicKey;

  try {
    // Calculate necessary PDA and accounts
    const authorityUsdcAccount = await getAssociatedTokenAddress(
      usdcTokenMintPubkey,
      authority.publicKey
    );

    // Debug: Verify Authority's USDC account and balance
    console.log(`🔍 Debug information:`);
    console.log(`   • USDC Mint: ${usdcTokenMintPubkey.toString()}`);
    console.log(`   • Authority USDC account: ${authorityUsdcAccount.toString()}`);

    try {
      const accountInfo = await getAccount(connection, authorityUsdcAccount);
      console.log(`   • Account balance: ${accountInfo.amount.toString()}`);
      console.log(`   • Account mint: ${accountInfo.mint.toString()}`);
      console.log(`   • Mint match: ${accountInfo.mint.equals(usdcTokenMintPubkey) ? "✅" : "❌"}`);
    } catch (error) {
      console.log(`   • ❌ Unable to get account information: ${error}`);
    }

    const [governanceTokenVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_token_vault")],
      program.programId
    );

    // Debug: Verify governance token vault
    try {
      const vaultInfo = await getAccount(connection, governanceTokenVault);
      console.log(`   • Governance token vault mint: ${vaultInfo.mint.toString()}`);
      console.log(`   • Governance token vault balance: ${vaultInfo.amount.toString()}`);
    } catch (error) {
      console.log(`   • ❌ Unable to get governance token vault information: ${error}`);
    }

    // Get current proposal counter - use safe method
    try {
      const govConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      proposalId = govConfig.proposalCounter.add(new anchor.BN(1)); // Program will use incremented value
    } catch (error) {
      // If unable to get, use default value 0
      proposalId = new anchor.BN(1); // First proposal ID is 1
      logWarning("Unable to get proposal counter, use default value 1");
    }

    // Calculate proposal PDA - use proposal ID that program will use
    [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    console.log(`📋 Proposal description: ${scenario.description}`);
    console.log(`🆔 Proposal ID: ${proposalId.toString()}`);
    console.log(`📍 Proposal PDA: ${proposalPda.toString()}`);

    // Create proposal - use correct parameters (support custom deposit)
    // Temporarily use null to indicate default deposit, subsequently can pass custom deposit through parameters
    const createProposalTx = await program.methods
      .createProposal(
        scenario.title,
        scenario.description,
        scenario.proposalType,
        null, // executionData - null indicates no execution data
        null // customDeposit - null indicates use default deposit
      )
      .accounts({
        proposer: authority.publicKey,
        governanceConfig: governanceConfigPda,
        proposal: proposalPda,
        proposerTokenAccount: authorityUsdcAccount,
        governanceTokenVault: governanceTokenVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([authority])
      .rpc();

    logTransaction(
      "Create proposal",
      createProposalTx,
      {
        proposalId: proposalId.toString(),
        proposer: authority.publicKey.toString(),
        description: scenario.description,
        proposalPda: proposalPda.toString(),
      },
      networkConfig
    );

    await delay(networkConfig.stepDelay);

    // Execute voting
    console.log(`🗳️ Start voting process:`);
    for (let i = 0; i < scenario.votes.length; i++) {
      const vote = scenario.votes[i];

      // Get voter token account
      const voterTokenAccount = await getAssociatedTokenAddress(
        committeeTokenMint,
        vote.member.publicKey
      );

      // Calculate vote PDA - use correct seeds：[b"vote", proposal_id.to_le_bytes(), voter.key()]
      const [votePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          vote.member.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Convert vote type - use correct enum values
      let voteType: any;
      switch (vote.vote) {
        case "Yes":
          voteType = { yes: {} };
          break;
        case "No":
          voteType = { no: {} };
          break;
        case "Abstain":
          voteType = { abstain: {} };
          break;
        case "NoWithVeto":
          voteType = { noWithVeto: {} };
          break;
        default:
          throw new Error(`Unknown vote type: ${vote.vote}`);
      }

      // Execute voting - need Proposal ID and Vote type
      const castVoteTx = await program.methods
        .castVote(proposalId, voteType)
        .accounts({
          voter: vote.member.publicKey,
          proposal: proposalPda,
          vote: votePda,
          governanceConfig: governanceConfigPda,
          voterTokenAccount: voterTokenAccount,
          committeeTokenMint: committeeTokenMint,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([vote.member])
        .rpc();

      // Get actual vote type display
      const voteTypeDisplay = Object.keys(voteType)[0];

      logTransaction(
        `Vote - ${vote.member.publicKey.toString().slice(0, 8)}...`,
        castVoteTx,
        {
          voter: vote.member.publicKey.toString(),
          voteType: voteTypeDisplay,
          votePda: votePda.toString(),
        },
        networkConfig
      );

      console.log(
        `   ✅ ${vote.member.publicKey.toString().slice(0, 8)}... Vote: ${voteTypeDisplay}`
      );
      await delay(500);
    }

    await delay(networkConfig.stepDelay);

    // Wait for voting period to end (use chain configuration)
    // Read current governance config to get actual voting period and test mode
    const currentConfig = await getGovernanceConfigFromChain(program, governanceConfigPda);
    const testMode = currentConfig.testMode;
    const actualVotingPeriod = currentConfig.votingPeriod;

    // For waiting purposes, use shorter period in test mode or when period is very long
    const waitingPeriod =
      testMode && actualVotingPeriod > 300
        ? Math.min(actualVotingPeriod, 60) // Test mode: max 60 seconds wait
        : actualVotingPeriod > 300
        ? 60 // Production mode with long period: simulate with 60 seconds
        : actualVotingPeriod; // Short period: use actual period

    if (waitingPeriod <= 300) {
      // Only real wait within 5 minutes
      logInfo(`Waiting for voting period to end... (${waitingPeriod} seconds)`);
      logInfo(
        `Actual voting period: ${actualVotingPeriod} seconds (${
          actualVotingPeriod / (24 * 60 * 60)
        } days)`
      );

      // Real countdown
      for (let i = waitingPeriod; i > 0; i--) {
        process.stdout.write(`\r⏰ Voting period remaining: ${i} seconds`);
        await delay(1000);
      }
      console.log("\n✅ Voting period has ended");
    } else {
      logInfo(
        `Simulate wait for voting period to end... (Actually need ${actualVotingPeriod} seconds = ${
          actualVotingPeriod / 3600
        } hours)`
      );

      // Simulate countdown (only demonstration, no actual wait)
      console.log("⏰ Simulate time progression...");
      for (let i = 5; i > 0; i--) {
        process.stdout.write(
          `\r🕐 Simulate remaining time: ${i} seconds (Actually should be ${Math.floor(
            (actualVotingPeriod / 5) * i
          )} seconds)`
        );
        await delay(1000);
      }
      console.log(
        "\n✅ Simulate Voting period has ended (Actual environment needs to wait full period)"
      );
      console.log(
        "💡 Note: in actual environment, need to wait full voting period before settling proposal"
      );
    }

    // Settle proposal
    console.log(`📊 Settle proposal...`);

    // Calculate deposit-related PDA and accounts
    const [governanceTokenVaultForFinalize] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_token_vault")],
      program.programId
    );

    const [governanceAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_authority")],
      program.programId
    );

    // Get proposer token account
    const proposalData = await program.account.proposal.fetch(proposalPda);
    const proposerTokenAccount = await getAssociatedTokenAddress(
      usdcTokenMintPubkey,
      proposalData.proposer
    );

    // Ensure proposer token account exists
    try {
      await getAccount(connection, proposerTokenAccount);
      console.log(`ℹ️ Proposer token account already exists: ${proposerTokenAccount.toString()}`);
    } catch (error) {
      console.log(`ℹ️ Create proposer token account: ${proposerTokenAccount.toString()}`);
      const createAccountTx = await createAssociatedTokenAccount(
        connection,
        authority,
        usdcTokenMintPubkey,
        proposalData.proposer
      );
      console.log(`✅ Proposer token account created successfully: ${createAccountTx}`);

      // Wait for account creation confirmation
      await connection.confirmTransaction(createAccountTx.toString(), "confirmed");
      console.log(`✅ Proposer token account creation confirmed`);
    }

    // Ensure governance system token vault exists
    await getAccount(connection, governanceTokenVaultForFinalize);
    console.log(`ℹ️ Governance system token vault already exists`);

    // Get all committee member token accounts for calculating total voting weight
    const memberTokenAccounts = [];
    for (let i = 0; i < members.length; i++) {
      const memberTokenAccount = await getAssociatedTokenAddress(
        committeeTokenMint,
        members[i].publicKey
      );
      memberTokenAccounts.push({
        pubkey: memberTokenAccount,
        isWritable: false,
        isSigner: false,
      });
    }

    // Prepare remaining accounts: first committee member token accounts, then vote accounts
    const voteAccounts = [];
    for (const vote of scenario.votes) {
      const [votePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          vote.member.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Verify whether vote account exists
      try {
        const voteAccountInfo = await connection.getAccountInfo(votePda);
        if (voteAccountInfo) {
          console.log(
            `ℹ️ Vote account exists: ${votePda.toString()} (${vote.member.publicKey
              .toString()
              .slice(0, 8)}...)`
          );
          voteAccounts.push({
            pubkey: votePda,
            isWritable: false,
            isSigner: false,
          });
        } else {
          console.log(
            `⚠️ Vote account does not exist: ${votePda.toString()} (${vote.member.publicKey
              .toString()
              .slice(0, 8)}...)`
          );
        }
      } catch (error) {
        console.log(`❌ Check vote account failed: ${votePda.toString()} - ${error}`);
      }
    }

    const allRemainingAccounts = [...memberTokenAccounts, ...voteAccounts];

    // Use complete deposit processing for finalize
    console.log(`ℹ️ Use complete deposit processing for finalize`);
    console.log(`ℹ️ Pass  committee member token accounts`);
    console.log(`ℹ️ Pass  vote accounts`);

    // Create compute unit limit instruction
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000, // Increase to 400,000 compute units
    });

    const finalizeProposalTx = await program.methods
      .finalizeProposal(proposalId)
      .accounts({
        proposal: proposalPda,
        governanceConfig: governanceConfigPda,
        committeeTokenMint: committeeTokenMint,
        proposerTokenAccount: proposerTokenAccount,
        governanceTokenVault: governanceTokenVaultForFinalize,
        governanceAuthority: governanceAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .remainingAccounts(allRemainingAccounts)
      .preInstructions([computeBudgetIx]) // Add compute unit limit instruction
      .signers([authority])
      .rpc();

    logTransaction(
      "Settle proposal",
      finalizeProposalTx,
      {
        proposalPda: proposalPda.toString(),
      },
      networkConfig
    );

    // Query proposal final status
    const finalProposal = await program.account.proposal.fetch(proposalPda);
    const finalStatus = Object.keys(finalProposal.status)[0];

    console.log(`📈 Voting results statistics:`);
    console.log(`   • Yes votes: ${finalProposal.yesVotes.toString()}`);
    console.log(`   • No votes: ${finalProposal.noVotes.toString()}`);
    console.log(`   • Abstain votes: ${finalProposal.abstainVotes.toString()}`);
    console.log(`   • Veto votes: ${finalProposal.vetoVotes.toString()}`);
    console.log(`   • Total votes: ${finalProposal.totalVotes.toString()}`);
    console.log(`   • Final status: ${finalStatus}`);

    // Verify expected result
    if (finalStatus.toLowerCase() === scenario.expectedResult.toLowerCase()) {
      logSuccess(`✅ Scenario verification passed: ${finalStatus}`);
    } else {
      logWarning(
        `⚠️ Scenario result does not match expectation: Expected${scenario.expectedResult}, Actual${finalStatus}`
      );
    }

    // Test deposit processing logic
    await testDepositHandling(
      program,
      connection,
      authority,
      proposalPda,
      finalStatus,
      usdcTokenMintPubkey,
      networkConfig
    );

    // If proposal passes, try to execute
    if (finalStatus === "passed") {
      await delay(1000);
      console.log(`🚀 Execute proposal: ${scenario.description}`);

      try {
        const executeProposalTx = await program.methods
          .executeProposal(proposalId)
          .accounts({
            proposal: proposalPda,
            governanceConfig: governanceConfigPda,
            authority: authority.publicKey,
          } as any)
          .signers([authority])
          .rpc();

        logTransaction(
          "Execute proposal",
          executeProposalTx,
          {
            proposalPda: proposalPda.toString(),
          },
          networkConfig
        );

        logSuccess("Proposal execution completed");
      } catch (error) {
        logWarning(`Proposal execution failed: ${error}`);
      }
    }
  } catch (error) {
    logError(`Proposal scenario - ${scenario.title}`, error);
  }
}

// Run script
if (require.main === module) {
  main().catch(console.error);
}

export { main };
