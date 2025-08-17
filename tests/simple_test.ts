import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Governance } from "../target/types/governance";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

describe("Simple Governance Test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Governance as Program<Governance>;
  const provider = anchor.getProvider();

  it("Should initialize governance system", async () => {
    // Generate unique accounts for this test
    const authority = Keypair.generate();
    const member1 = Keypair.generate();
    
    // Airdrop SOL
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(member1.publicKey, 2 * LAMPORTS_PER_SOL)
    );

    // Create committee token mint
    const committeeTokenMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      9
    );

    // Use unique seed for this test
    const testSeed = `governance_config_${Date.now()}`;
    const [governanceConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(testSeed)],
      program.programId
    );

    console.log("Test seed:", testSeed);
    console.log("Program ID:", program.programId.toString());
    console.log("Governance Config PDA:", governanceConfigPda.toString());

    // Initialize governance system
    const proposalDeposit = new anchor.BN(100 * 10**6);
    const votingPeriod = new anchor.BN(60);
    const participationThreshold = 5000;
    const approvalThreshold = 6000;
    const vetoThreshold = 3000;
    const feeRate = 250;
    const testMode = true;

    try {
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

      // Test adding committee member
      const addMemberTx = await program.methods
        .addCommitteeMember(member1.publicKey)
        .accounts({
          governanceConfig: governanceConfigPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      console.log("Add member transaction signature:", addMemberTx);

      // Verify member was added
      const updatedConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      expect(updatedConfig.committeeMemberCount).to.equal(1);
      
      const members = updatedConfig.committeeMembers.filter(member => member !== null);
      expect(members).to.have.lengthOf(1);
      expect(members[0].toString()).to.equal(member1.publicKey.toString());

      console.log("✅ Committee member added successfully");

    } catch (error) {
      console.error("Test failed:", error);
      throw error;
    }
  });

  it("Should create rule registry", async () => {
    // Generate unique accounts for this test
    const authority = Keypair.generate();
    
    // Airdrop SOL
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL)
    );

    // Create committee token mint
    const committeeTokenMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      9
    );

    // Use unique seeds for this test
    const configSeed = `governance_config_${Date.now()}_2`;
    const registrySeed = `rule_registry_${Date.now()}`;
    
    const [governanceConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(configSeed)],
      program.programId
    );

    const [ruleRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(registrySeed)],
      program.programId
    );

    // First initialize governance
    await program.methods
      .initializeGovernance(
        new anchor.BN(100 * 10**6),
        new anchor.BN(60),
        5000,
        6000,
        3000,
        250,
        true
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

    // Create rule registry
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

  it("Should initialize token vault", async () => {
    // Generate unique accounts for this test
    const authority = Keypair.generate();
    
    // Airdrop SOL
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL)
    );

    // Create committee token mint
    const committeeTokenMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      9
    );

    // Use unique seeds for this test
    const vaultSeed = `governance_token_vault_${Date.now()}`;
    const authoritySeed = `governance_authority_${Date.now()}`;
    
    const [governanceTokenVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(vaultSeed)],
      program.programId
    );

    const [governanceAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(authoritySeed)],
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
});
