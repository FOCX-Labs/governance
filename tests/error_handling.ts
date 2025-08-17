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

describe("Error Handling and Edge Cases", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Governance as Program<Governance>;
  const provider = anchor.getProvider();

  // Test accounts
  let authority: Keypair;
  let committeeTokenMint: PublicKey;
  let member1: Keypair;
  let member2: Keypair;
  let nonMember: Keypair;

  // PDAs
  let governanceConfigPda: PublicKey;
  let governanceTokenVaultPda: PublicKey;
  let governanceAuthorityPda: PublicKey;

  // Token accounts
  let member1TokenAccount: PublicKey;
  let member2TokenAccount: PublicKey;

  before(async () => {
    // Initialize test accounts
    authority = Keypair.generate();
    member1 = Keypair.generate();
    member2 = Keypair.generate();
    nonMember = Keypair.generate();

    // Airdrop SOL
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(member1.publicKey, 2 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(member2.publicKey, 2 * LAMPORTS_PER_SOL)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(nonMember.publicKey, 2 * LAMPORTS_PER_SOL)
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

    [governanceTokenVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_token_vault")],
      program.programId
    );

    [governanceAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("governance_authority")],
      program.programId
    );

    // Create token accounts and mint tokens
    member1TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      member1,
      committeeTokenMint,
      member1.publicKey
    );

    member2TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      member2,
      committeeTokenMint,
      member2.publicKey
    );

    // Mint tokens
    await mintTo(
      provider.connection,
      authority,
      committeeTokenMint,
      member1TokenAccount,
      authority,
      1000 * 10 ** 9
    );

    await mintTo(
      provider.connection,
      authority,
      committeeTokenMint,
      member2TokenAccount,
      authority,
      1500 * 10 ** 9
    );

    // Initialize governance system
    await program.methods
      .initializeGovernance(
        new anchor.BN(100 * 10 ** 6),
        new anchor.BN(60),
        5000, // 50%
        6000, // 60%
        3000, // 30%
        250, // 2.5%
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

    // Add committee members
    await program.methods
      .addCommitteeMember(member1.publicKey)
      .accounts({
        governanceConfig: governanceConfigPda,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    await program.methods
      .addCommitteeMember(member2.publicKey)
      .accounts({
        governanceConfig: governanceConfigPda,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Initialize token vault
    await program.methods
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
  });

  describe("Initialization Errors", () => {
    it("Should fail to initialize with invalid participation threshold", async () => {
      const [invalidConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("governance_config_invalid")],
        program.programId
      );

      try {
        await program.methods
          .initializeGovernance(
            new anchor.BN(100 * 10 ** 6),
            new anchor.BN(60),
            15000, // > 10000 (100%)
            6000,
            3000,
            250,
            true
          )
          .accounts({
            governanceConfig: invalidConfigPda,
            committeeTokenMint: committeeTokenMint,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();

        expect.fail("Should have failed with InvalidThreshold");
      } catch (error) {
        expect(error.toString()).to.include("InvalidThreshold");
      }
    });

    it("Should fail to initialize with invalid approval threshold", async () => {
      const [invalidConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("governance_config_invalid2")],
        program.programId
      );

      try {
        await program.methods
          .initializeGovernance(
            new anchor.BN(100 * 10 ** 6),
            new anchor.BN(60),
            5000,
            15000, // > 10000 (100%)
            3000,
            250,
            true
          )
          .accounts({
            governanceConfig: invalidConfigPda,
            committeeTokenMint: committeeTokenMint,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();

        expect.fail("Should have failed with InvalidThreshold");
      } catch (error) {
        expect(error.toString()).to.include("InvalidThreshold");
      }
    });

    it("Should fail to initialize with invalid fee rate", async () => {
      const [invalidConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("governance_config_invalid3")],
        program.programId
      );

      try {
        await program.methods
          .initializeGovernance(
            new anchor.BN(100 * 10 ** 6),
            new anchor.BN(60),
            5000,
            6000,
            3000,
            15000, // > 10000 (100%)
            true
          )
          .accounts({
            governanceConfig: invalidConfigPda,
            committeeTokenMint: committeeTokenMint,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();

        expect.fail("Should have failed with InvalidFeeRate");
      } catch (error) {
        expect(error.toString()).to.include("InvalidFeeRate");
      }
    });
  });

  describe("Committee Management Errors", () => {
    it("Should fail to add duplicate committee member", async () => {
      try {
        await program.methods
          .addCommitteeMember(member1.publicKey) // Already added
          .accounts({
            governanceConfig: governanceConfigPda,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();

        expect.fail("Should have failed with MemberAlreadyExists");
      } catch (error) {
        expect(error.toString()).to.include("MemberAlreadyExists");
      }
    });

    it("Should fail to remove non-existent committee member", async () => {
      try {
        await program.methods
          .removeCommitteeMember(nonMember.publicKey) // Not a member
          .accounts({
            governanceConfig: governanceConfigPda,
            authority: authority.publicKey,
          })
          .signers([authority])
          .rpc();

        expect.fail("Should have failed with MemberNotFound");
      } catch (error) {
        expect(error.toString()).to.include("MemberNotFound");
      }
    });

    it("Should fail to add committee member by non-authority", async () => {
      try {
        await program.methods
          .addCommitteeMember(nonMember.publicKey)
          .accounts({
            governanceConfig: governanceConfigPda,
            authority: member1.publicKey, // Not the authority
          })
          .signers([member1])
          .rpc();

        expect.fail("Should have failed with Unauthorized");
      } catch (error) {
        expect(error.toString()).to.include("Unauthorized");
      }
    });
  });

  describe("Proposal Creation Errors", () => {
    it("Should fail to create proposal with insufficient token balance", async () => {
      // Create a member with no tokens
      const poorMember = Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(poorMember.publicKey, 2 * LAMPORTS_PER_SOL)
      );

      const poorMemberTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        poorMember,
        committeeTokenMint,
        poorMember.publicKey
      );

      // Add as committee member
      await program.methods
        .addCommitteeMember(poorMember.publicKey)
        .accounts({
          governanceConfig: governanceConfigPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      const proposalId = governanceConfig.proposalCounter;

      const [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .createProposal(
            "Test Proposal with No Tokens",
            "This proposal should fail because the proposer has no tokens for deposit.",
            { configUpdate: {} },
            null
          )
          .accounts({
            proposal: proposalPda,
            governanceConfig: governanceConfigPda,
            proposer: poorMember.publicKey,
            proposerTokenAccount: poorMemberTokenAccount,
            governanceTokenVault: governanceTokenVaultPda,
            governanceAuthority: governanceAuthorityPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([poorMember])
          .rpc();

        expect.fail("Should have failed with insufficient token balance");
      } catch (error) {
        expect(error.toString()).to.include("insufficient");
      }
    });

    it("Should fail to create proposal with empty title", async () => {
      const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      const proposalId = governanceConfig.proposalCounter;

      const [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .createProposal(
            "", // Empty title
            "This proposal should fail because the title is empty.",
            { configUpdate: {} },
            null
          )
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

        expect.fail("Should have failed with InvalidProposalTitleLength");
      } catch (error) {
        expect(error.toString()).to.include("InvalidProposalTitleLength");
      }
    });
  });

  describe("Voting Errors", () => {
    let proposalPda: PublicKey;
    let proposalId: anchor.BN;

    before(async () => {
      // Create a proposal for voting error tests
      const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      proposalId = governanceConfig.proposalCounter;

      [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .createProposal(
          "Test Proposal for Voting Errors",
          "This proposal is created specifically for testing voting error conditions.",
          { configUpdate: {} },
          null
        )
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
    });

    it("Should fail to vote on non-existent proposal", async () => {
      const [nonExistentVotePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          new anchor.BN(999).toArrayLike(Buffer, "le", 8),
          member1.publicKey.toBuffer(),
        ],
        program.programId
      );

      const [nonExistentProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), new anchor.BN(999).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .castVote(new anchor.BN(999), { yes: {} })
          .accounts({
            proposal: nonExistentProposalPda,
            vote: nonExistentVotePda,
            governanceConfig: governanceConfigPda,
            voter: member1.publicKey,
            voterTokenAccount: member1TokenAccount,
            committeeTokenMint: committeeTokenMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([member1])
          .rpc();

        expect.fail("Should have failed with account not found");
      } catch (error) {
        expect(error.toString()).to.include("AccountNotInitialized");
      }
    });

    it("Should fail to vote with zero token balance", async () => {
      // Create a member with zero tokens
      const zeroTokenMember = Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(zeroTokenMember.publicKey, 2 * LAMPORTS_PER_SOL)
      );

      const zeroTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        zeroTokenMember,
        committeeTokenMint,
        zeroTokenMember.publicKey
      );

      // Add as committee member
      await program.methods
        .addCommitteeMember(zeroTokenMember.publicKey)
        .accounts({
          governanceConfig: governanceConfigPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      const [zeroTokenVotePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          zeroTokenMember.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .castVote(proposalId, { yes: {} })
          .accounts({
            proposal: proposalPda,
            vote: zeroTokenVotePda,
            governanceConfig: governanceConfigPda,
            voter: zeroTokenMember.publicKey,
            voterTokenAccount: zeroTokenAccount,
            committeeTokenMint: committeeTokenMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([zeroTokenMember])
          .rpc();

        expect.fail("Should have failed with InsufficientVotingPower");
      } catch (error) {
        expect(error.toString()).to.include("InsufficientVotingPower");
      }
    });
  });
});
