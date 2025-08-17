import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Governance } from "../target/types/governance";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

describe("Basic Governance System Test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Governance as Program<Governance>;
  const provider = anchor.getProvider();

  // Test accounts
  let authority: Keypair;
  let committeeTokenMint: PublicKey;
  let member1: Keypair;

  // PDAs
  let governanceConfigPda: PublicKey;

  before(async () => {
    // Initialize test accounts
    authority = Keypair.generate();
    member1 = Keypair.generate();

    // Airdrop SOL to test accounts
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(member1.publicKey, 2 * LAMPORTS_PER_SOL)
    );

    // Create committee token mint
    committeeTokenMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      9
    );

    // Calculate PDAs
    [governanceConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_config")],
      program.programId
    );

    console.log("Program ID:", program.programId.toString());
    console.log("Governance Config PDA:", governanceConfigPda.toString());
  });

  it("Should initialize governance system successfully", async () => {
    const proposalDeposit = new anchor.BN(100 * 10 ** 6); // 100 USDC (6 decimals)
    const votingPeriod = new anchor.BN(60); // 60 seconds for testing
    const participationThreshold = 5000; // 50%
    const approvalThreshold = 6000; // 60%
    const vetoThreshold = 3000; // 30%
    const feeRate = 250; // 2.5%
    const testMode = true;

    const tx = await program.methods
      .initializeGovernance(
        proposalDeposit,
        votingPeriod,
        participationThreshold,
        approvalThreshold,
        vetoThreshold,
        feeRate,
        testMode
      )
      .accounts({
        governanceConfig: governanceConfigPda,
        committeeTokenMint: committeeTokenMint,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    console.log("Initialize transaction signature:", tx);

    // Verify governance config
    const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
    expect(governanceConfig.authority.toString()).to.equal(authority.publicKey.toString());
    expect(governanceConfig.committeeTokenMint.toString()).to.equal(committeeTokenMint.toString());
    expect(governanceConfig.committeeMemberCount).to.equal(0);
    expect(governanceConfig.proposalCounter.toString()).to.equal("0");
    expect(governanceConfig.participationThreshold).to.equal(participationThreshold);
    expect(governanceConfig.approvalThreshold).to.equal(approvalThreshold);
    expect(governanceConfig.vetoThreshold).to.equal(vetoThreshold);
    expect(governanceConfig.feeRate).to.equal(feeRate);
    expect(governanceConfig.testMode).to.equal(testMode);

    console.log("✅ Governance system initialized successfully");
  });

  it("Should add committee member successfully", async () => {
    const tx = await program.methods
      .addCommitteeMember(member1.publicKey)
      .accounts({
        governanceConfig: governanceConfigPda,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    console.log("Add member transaction signature:", tx);

    // Verify member was added
    const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
    expect(governanceConfig.committeeMemberCount).to.equal(1);

    const members = governanceConfig.committeeMembers.filter((member) => member !== null);
    expect(members).to.have.lengthOf(1);
    expect(members[0].toString()).to.equal(member1.publicKey.toString());

    console.log("✅ Committee member added successfully");
  });

  it("Should create rule registry successfully", async () => {
    const [ruleRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("rule_registry")],
      program.programId
    );

    const tx = await program.methods
      .createRuleRegistry()
      .accounts({
        ruleRegistry: ruleRegistryPda,
        governanceConfig: governanceConfigPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("Create rule registry transaction signature:", tx);

    // Verify rule registry
    const ruleRegistry = await program.account.ruleRegistry.fetch(ruleRegistryPda);
    expect(ruleRegistry.authority.toString()).to.equal(authority.publicKey.toString());
    expect(ruleRegistry.ruleDocuments).to.have.lengthOf(0);
    expect(ruleRegistry.version).to.equal(1);

    console.log("✅ Rule registry created successfully");
  });

  it("Should initialize token vault successfully", async () => {
    const [governanceTokenVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_token_vault")],
      program.programId
    );

    const [governanceAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_authority")],
      program.programId
    );

    const tx = await program.methods
      .initializeTokenVault()
      .accounts({
        tokenVault: governanceTokenVaultPda,
        mint: committeeTokenMint,
        governanceAuthority: governanceAuthorityPda,
        payer: authority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc();

    console.log("Initialize token vault transaction signature:", tx);

    // Verify token vault was created
    const vaultInfo = await provider.connection.getAccountInfo(governanceTokenVaultPda);
    expect(vaultInfo).to.not.be.null;

    console.log("✅ Token vault initialized successfully");
  });

  it("Should create proposal successfully", async () => {
    // First create token account for member1 and mint some tokens
    const member1TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      member1,
      committeeTokenMint,
      member1.publicKey
    );

    await mintTo(
      provider.connection,
      authority,
      committeeTokenMint,
      member1TokenAccount,
      authority,
      1000 * 10 ** 9 // 1000 tokens
    );

    const [governanceTokenVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_token_vault")],
      program.programId
    );

    const [governanceAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_authority")],
      program.programId
    );

    // Get current proposal counter and calculate next proposal ID
    const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
    const nextProposalId = governanceConfig.proposalCounter.add(new anchor.BN(1)); // next_proposal_id() increments first

    const [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), nextProposalId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    const title = "Test Proposal for Fee Rate Update";
    const description = "This is a test proposal to update the governance system fee rate.";
    const proposalType = { configUpdate: {} };
    const executionData = {
      configUpdate: {
        proposalDeposit: null,
        votingPeriod: null,
        participationThreshold: null,
        approvalThreshold: null,
        vetoThreshold: null,
        feeRate: 350, // 3.5%
        testMode: null,
      },
    };

    const tx = await program.methods
      .createProposal(title, description, proposalType, executionData)
      .accounts({
        proposal: proposalPda,
        governanceConfig: governanceConfigPda,
        proposer: member1.publicKey,
        proposerTokenAccount: member1TokenAccount,
        governanceTokenVault: governanceTokenVaultPda,
        governanceAuthority: governanceAuthorityPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([member1])
      .rpc();

    console.log("Create proposal transaction signature:", tx);

    // Verify proposal was created
    const proposal = await program.account.proposal.fetch(proposalPda);
    expect(proposal.id.toString()).to.equal("1"); // First proposal should have ID 1 (counter starts at 0, increments to 1)
    expect(proposal.proposer.toString()).to.equal(member1.publicKey.toString());
    expect(proposal.title).to.equal(title);
    expect(proposal.description).to.equal(description);
    expect(proposal.status).to.deep.equal({ pending: {} });

    console.log("✅ Proposal created successfully");
  });
});
