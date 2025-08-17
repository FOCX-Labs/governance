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

describe("Proposal Finalization and Execution", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Governance as Program<Governance>;
  const provider = anchor.getProvider();

  // Test accounts
  let authority: Keypair;
  let committeeTokenMint: PublicKey;
  let member1: Keypair;
  let member2: Keypair;
  let member3: Keypair;

  // PDAs
  let governanceConfigPda: PublicKey;
  let governanceTokenVaultPda: PublicKey;
  let governanceAuthorityPda: PublicKey;

  // Token accounts
  let member1TokenAccount: PublicKey;
  let member2TokenAccount: PublicKey;
  let member3TokenAccount: PublicKey;

  before(async () => {
    // Initialize test accounts
    authority = Keypair.generate();
    member1 = Keypair.generate();
    member2 = Keypair.generate();
    member3 = Keypair.generate();

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
      await provider.connection.requestAirdrop(member3.publicKey, 2 * LAMPORTS_PER_SOL)
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

    member3TokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      member3,
      committeeTokenMint,
      member3.publicKey
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

    await mintTo(
      provider.connection,
      authority,
      committeeTokenMint,
      member3TokenAccount,
      authority,
      500 * 10 ** 9
    );

    // Initialize governance system
    await program.methods
      .initializeGovernance(
        new anchor.BN(100 * 10 ** 6),
        new anchor.BN(1), // 1 second for testing
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

    await program.methods
      .addCommitteeMember(member3.publicKey)
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

  describe("Proposal Finalization", () => {
    let proposalPda: PublicKey;
    let proposalId: anchor.BN;

    beforeEach(async () => {
      // Get current proposal counter
      const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      proposalId = governanceConfig.proposalCounter;

      [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
    });

    it("Should finalize proposal with passed status", async () => {
      // Create proposal
      await program.methods
        .createProposal(
          "Test Passed Proposal",
          "This proposal should pass with majority approval from committee members.",
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

      // Cast votes - majority approval
      const [vote1Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          member1.publicKey.toBuffer(),
        ],
        program.programId
      );

      const [vote2Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          member2.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .castVote(proposalId, { approve: {} })
        .accounts({
          proposal: proposalPda,
          vote: vote1Pda,
          governanceConfig: governanceConfigPda,
          voter: member1.publicKey,
          voterTokenAccount: member1TokenAccount,
          committeeTokenMint: committeeTokenMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([member1])
        .rpc();

      await program.methods
        .castVote(proposalId, { approve: {} })
        .accounts({
          proposal: proposalPda,
          vote: vote2Pda,
          governanceConfig: governanceConfigPda,
          voter: member2.publicKey,
          voterTokenAccount: member2TokenAccount,
          committeeTokenMint: committeeTokenMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([member2])
        .rpc();

      // Wait for voting period to end
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Finalize proposal
      await program.methods
        .finalizeProposal(proposalId)
        .accounts({
          proposal: proposalPda,
          governanceConfig: governanceConfigPda,
          committeeTokenMint: committeeTokenMint,
          proposerTokenAccount: member1TokenAccount,
          governanceTokenVault: governanceTokenVaultPda,
          governanceAuthority: governanceAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: member1TokenAccount, isWritable: false, isSigner: false },
          { pubkey: member2TokenAccount, isWritable: false, isSigner: false },
          { pubkey: member3TokenAccount, isWritable: false, isSigner: false },
        ])
        .signers([authority])
        .rpc();

      // Verify proposal status
      const proposal = await program.account.proposal.fetch(proposalPda);
      expect(proposal.status).to.deep.equal({ passed: {} });
    });

    it("Should finalize proposal with rejected status", async () => {
      // Create proposal
      await program.methods
        .createProposal(
          "Test Rejected Proposal",
          "This proposal should be rejected due to insufficient approval votes.",
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

      // Cast votes - majority rejection
      const [vote1Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          member1.publicKey.toBuffer(),
        ],
        program.programId
      );

      const [vote2Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          member2.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .castVote(proposalId, { no: {} })
        .accounts({
          proposal: proposalPda,
          vote: vote1Pda,
          governanceConfig: governanceConfigPda,
          voter: member1.publicKey,
          voterTokenAccount: member1TokenAccount,
          committeeTokenMint: committeeTokenMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([member1])
        .rpc();

      await program.methods
        .castVote(proposalId, { no: {} })
        .accounts({
          proposal: proposalPda,
          vote: vote2Pda,
          governanceConfig: governanceConfigPda,
          voter: member2.publicKey,
          voterTokenAccount: member2TokenAccount,
          committeeTokenMint: committeeTokenMint,
          systemProgram: SystemProgram.programId,
        })
        .signers([member2])
        .rpc();

      // Wait for voting period to end
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Finalize proposal
      await program.methods
        .finalizeProposal(proposalId)
        .accounts({
          proposal: proposalPda,
          governanceConfig: governanceConfigPda,
          committeeTokenMint: committeeTokenMint,
          proposerTokenAccount: member1TokenAccount,
          governanceTokenVault: governanceTokenVaultPda,
          governanceAuthority: governanceAuthorityPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: member1TokenAccount, isWritable: false, isSigner: false },
          { pubkey: member2TokenAccount, isWritable: false, isSigner: false },
          { pubkey: member3TokenAccount, isWritable: false, isSigner: false },
        ])
        .signers([authority])
        .rpc();

      // Verify proposal status
      const proposal = await program.account.proposal.fetch(proposalPda);
      expect(proposal.status).to.deep.equal({ rejected: {} });
    });
  });
});
