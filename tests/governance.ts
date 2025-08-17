import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Governance } from "../target/types/governance";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { expect } from "chai";

describe("Governance System", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Governance as Program<Governance>;
  const provider = anchor.getProvider();

  // Test accounts
  let authority: Keypair;
  let committeeTokenMint: PublicKey;
  let member1: Keypair;
  let member2: Keypair;
  let member3: Keypair;
  let nonMember: Keypair;

  // PDAs
  let governanceConfigPda: PublicKey;
  let ruleRegistryPda: PublicKey;
  let governanceTokenVaultPda: PublicKey;
  let governanceAuthorityPda: PublicKey;

  // Token accounts
  let authorityTokenAccount: PublicKey;
  let member1TokenAccount: PublicKey;
  let member2TokenAccount: PublicKey;
  let member3TokenAccount: PublicKey;

  before(async () => {
    // Initialize test accounts
    authority = Keypair.generate();
    member1 = Keypair.generate();
    member2 = Keypair.generate();
    member3 = Keypair.generate();
    nonMember = Keypair.generate();

    // Airdrop SOL to test accounts
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

    [ruleRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("rule_registry")],
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

    // Create token accounts
    authorityTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      authority,
      committeeTokenMint,
      authority.publicKey
    );

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

    // Mint tokens to committee members
    await mintTo(
      provider.connection,
      authority,
      committeeTokenMint,
      member1TokenAccount,
      authority,
      1000 * 10 ** 9 // 1000 tokens
    );

    await mintTo(
      provider.connection,
      authority,
      committeeTokenMint,
      member2TokenAccount,
      authority,
      1500 * 10 ** 9 // 1500 tokens
    );

    await mintTo(
      provider.connection,
      authority,
      committeeTokenMint,
      member3TokenAccount,
      authority,
      500 * 10 ** 9 // 500 tokens
    );
  });

  describe("Governance System Initialization", () => {
    it("Should initialize governance system successfully", async () => {
      const proposalDeposit = new anchor.BN(100 * 10 ** 6); // 100 USDC (6 decimals)
      const votingPeriod = new anchor.BN(60); // 60 seconds for testing
      const participationThreshold = 5000; // 50%
      const approvalThreshold = 6000; // 60%
      const vetoThreshold = 3000; // 30%
      const feeRate = 250; // 2.5%
      const testMode = true;

      await program.methods
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

      // Verify governance config
      const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      expect(governanceConfig.authority.toString()).to.equal(authority.publicKey.toString());
      expect(governanceConfig.committeeTokenMint.toString()).to.equal(
        committeeTokenMint.toString()
      );
      expect(governanceConfig.committeeMemberCount).to.equal(0);
      expect(governanceConfig.proposalCounter.toString()).to.equal("0");
      expect(governanceConfig.participationThreshold).to.equal(participationThreshold);
      expect(governanceConfig.approvalThreshold).to.equal(approvalThreshold);
      expect(governanceConfig.vetoThreshold).to.equal(vetoThreshold);
      expect(governanceConfig.feeRate).to.equal(feeRate);
      expect(governanceConfig.testMode).to.equal(testMode);
    });

    it("Should fail to initialize with invalid thresholds", async () => {
      const invalidThreshold = 15000; // > 10000 (100%)

      try {
        await program.methods
          .initializeGovernance(
            new anchor.BN(100 * 10 ** 6),
            new anchor.BN(60),
            invalidThreshold, // Invalid
            6000,
            3000,
            250,
            true
          )
          .accounts({
            governanceConfig: PublicKey.findProgramAddressSync(
              [Buffer.from("governance_config_invalid")],
              program.programId
            )[0],
            committeeTokenMint: committeeTokenMint,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();

        expect.fail("Should have failed with invalid threshold");
      } catch (error) {
        expect(error.toString()).to.include("InvalidThreshold");
      }
    });
  });

  describe("Committee Member Management", () => {
    it("Should add committee members successfully", async () => {
      // Add member1
      await program.methods
        .addCommitteeMember(member1.publicKey)
        .accounts({
          governanceConfig: governanceConfigPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Add member2
      await program.methods
        .addCommitteeMember(member2.publicKey)
        .accounts({
          governanceConfig: governanceConfigPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Add member3
      await program.methods
        .addCommitteeMember(member3.publicKey)
        .accounts({
          governanceConfig: governanceConfigPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Verify members were added
      const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      expect(governanceConfig.committeeMemberCount).to.equal(3);

      const members = governanceConfig.committeeMembers.filter((member) => member !== null);
      expect(members).to.have.lengthOf(3);
      expect(members.map((m) => m.toString())).to.include(member1.publicKey.toString());
      expect(members.map((m) => m.toString())).to.include(member2.publicKey.toString());
      expect(members.map((m) => m.toString())).to.include(member3.publicKey.toString());
    });

    it("Should fail to add member by non-authority", async () => {
      try {
        await program.methods
          .addCommitteeMember(nonMember.publicKey)
          .accounts({
            governanceConfig: governanceConfigPda,
            authority: member1.publicKey, // Not the authority
          })
          .signers([member1])
          .rpc();

        expect.fail("Should have failed with unauthorized");
      } catch (error) {
        expect(error.toString()).to.include("Unauthorized");
      }
    });

    it("Should remove committee member successfully", async () => {
      await program.methods
        .removeCommitteeMember(member3.publicKey)
        .accounts({
          governanceConfig: governanceConfigPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Verify member was removed
      const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      expect(governanceConfig.committeeMemberCount).to.equal(2);

      const members = governanceConfig.committeeMembers.filter((member) => member !== null);
      expect(members.map((m) => m.toString())).to.not.include(member3.publicKey.toString());
    });
  });

  describe("Rule Registry Management", () => {
    it("Should create rule registry successfully", async () => {
      await program.methods
        .createRuleRegistry()
        .accounts({
          ruleRegistry: ruleRegistryPda,
          governanceConfig: governanceConfigPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify rule registry
      const ruleRegistry = await program.account.ruleRegistry.fetch(ruleRegistryPda);
      expect(ruleRegistry.authority.toString()).to.equal(authority.publicKey.toString());
      expect(ruleRegistry.ruleDocuments).to.have.lengthOf(0);
      expect(ruleRegistry.version).to.equal(1);
    });

    it("Should add rule document successfully", async () => {
      const category = "product_standards";
      const title = "Product Quality Standards v1.0";
      const url = "https://example.com/rules/product-standards-v1.pdf";
      const hash = "abc123def456789012345678901234567890123456789012345678901234567890";

      await program.methods
        .addRuleDocument(category, title, url, hash)
        .accounts({
          ruleRegistry: ruleRegistryPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Verify document was added
      const ruleRegistry = await program.account.ruleRegistry.fetch(ruleRegistryPda);
      expect(ruleRegistry.ruleDocuments).to.have.lengthOf(1);
      expect(ruleRegistry.version).to.equal(2);

      const document = ruleRegistry.ruleDocuments[0];
      expect(document.category).to.equal(category);
      expect(document.title).to.equal(title);
      expect(document.url).to.equal(url);
      expect(document.hash).to.equal(hash);
    });

    it("Should update rule document successfully", async () => {
      const newUrl = "https://example.com/rules/product-standards-v2.pdf";
      const newHash = "def456abc123789012345678901234567890123456789012345678901234567890";

      await program.methods
        .updateRuleDocument(0, newUrl, newHash)
        .accounts({
          ruleRegistry: ruleRegistryPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Verify document was updated
      const ruleRegistry = await program.account.ruleRegistry.fetch(ruleRegistryPda);
      const document = ruleRegistry.ruleDocuments[0];
      expect(document.url).to.equal(newUrl);
      expect(document.hash).to.equal(newHash);
      expect(ruleRegistry.version).to.equal(3);
    });

    it("Should remove rule document successfully", async () => {
      await program.methods
        .removeRuleDocument(0)
        .accounts({
          ruleRegistry: ruleRegistryPda,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      // Verify document was removed
      const ruleRegistry = await program.account.ruleRegistry.fetch(ruleRegistryPda);
      expect(ruleRegistry.ruleDocuments).to.have.lengthOf(0);
      expect(ruleRegistry.version).to.equal(4);
    });

    it("Should fail to add rule document by non-authority", async () => {
      try {
        await program.methods
          .addRuleDocument(
            "test_category",
            "Test Document",
            "https://example.com/test.pdf",
            "1234567890123456789012345678901234567890123456789012345678901234"
          )
          .accounts({
            ruleRegistry: ruleRegistryPda,
            authority: member1.publicKey, // Not the authority
          })
          .signers([member1])
          .rpc();

        expect.fail("Should have failed with unauthorized");
      } catch (error) {
        expect(error.toString()).to.include("Unauthorized");
      }
    });
  });

  describe("Token Vault Management", () => {
    it("Should initialize token vault successfully", async () => {
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

      // Verify token vault was created
      const vaultInfo = await provider.connection.getAccountInfo(governanceTokenVaultPda);
      expect(vaultInfo).to.not.be.null;
    });
  });

  describe("Proposal Management", () => {
    let proposalPda: PublicKey;
    let proposalId: anchor.BN;

    before(async () => {
      // Get current proposal counter
      const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      proposalId = governanceConfig.proposalCounter;

      [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
    });

    it("Should create proposal successfully by committee member", async () => {
      const title = "Test Proposal for Fee Rate Update";
      const description =
        "This is a test proposal to update the governance system fee rate from 2.5% to 3.5%.";
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

      await program.methods
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

      // Verify proposal was created
      const proposal = await program.account.proposal.fetch(proposalPda);
      expect(proposal.id.toString()).to.equal(proposalId.toString());
      expect(proposal.proposer.toString()).to.equal(member1.publicKey.toString());
      expect(proposal.title).to.equal(title);
      expect(proposal.description).to.equal(description);
      expect(proposal.status).to.deep.equal({ active: {} });
      expect(proposal.yesVotes.toString()).to.equal("0");
      expect(proposal.noVotes.toString()).to.equal("0");
      expect(proposal.abstainVotes.toString()).to.equal("0");
      expect(proposal.vetoVotes.toString()).to.equal("0");
    });

    it("Should create proposal successfully by non-committee member", async () => {
      // Create token account for non-member
      const nonMemberTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        nonMember,
        committeeTokenMint,
        nonMember.publicKey
      );

      // Mint some tokens to non-member for deposit
      await mintTo(
        provider.connection,
        authority,
        committeeTokenMint,
        nonMemberTokenAccount,
        authority,
        200 * 10 ** 9 // 200 tokens for deposit
      );

      const [nonMemberProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), new anchor.BN(999).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .createProposal(
          "Non-member Proposal",
          "This proposal is created by a non-committee member to test the new permission system.",
          { configUpdate: {} },
          null
        )
        .accounts({
          proposal: nonMemberProposalPda,
          governanceConfig: governanceConfigPda,
          proposer: nonMember.publicKey,
          proposerTokenAccount: nonMemberTokenAccount,
          governanceTokenVault: governanceTokenVaultPda,
          governanceAuthority: governanceAuthorityPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([nonMember])
        .rpc();

      // Verify proposal was created
      const proposal = await program.account.proposal.fetch(nonMemberProposalPda);
      expect(proposal.proposer.toString()).to.equal(nonMember.publicKey.toString());
      expect(proposal.title).to.equal("Non-member Proposal");
      expect(proposal.status).to.deep.equal({ active: {} });
    });

    it("Should fail to create proposal with title too long", async () => {
      const [invalidProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), new anchor.BN(998).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Create a title longer than 100 characters
      const longTitle = "A".repeat(101);

      try {
        await program.methods
          .createProposal(
            longTitle, // Too long (> 100 characters)
            "This proposal should fail because the title is too long.",
            { configUpdate: {} },
            null
          )
          .accounts({
            proposal: invalidProposalPda,
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

    it("Should create proposal with empty title successfully", async () => {
      const [emptyTitleProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), new anchor.BN(997).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .createProposal(
          "", // Empty title is now allowed
          "This proposal tests that empty titles are now allowed.",
          { configUpdate: {} },
          null
        )
        .accounts({
          proposal: emptyTitleProposalPda,
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

      // Verify proposal was created with empty title
      const proposal = await program.account.proposal.fetch(emptyTitleProposalPda);
      expect(proposal.title).to.equal("");
      expect(proposal.status).to.deep.equal({ pending: {} });
    });

    it("Should fail to create proposal with description too long", async () => {
      const [invalidProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), new anchor.BN(996).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Create a description longer than 800 characters
      const longDescription = "A".repeat(801);

      try {
        await program.methods
          .createProposal(
            "Valid Title",
            longDescription, // Too long (> 800 characters)
            { configUpdate: {} },
            null
          )
          .accounts({
            proposal: invalidProposalPda,
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

        expect.fail("Should have failed with InvalidProposalDescriptionLength");
      } catch (error) {
        expect(error.toString()).to.include("InvalidProposalDescriptionLength");
      }
    });
  });

  describe("Voting System", () => {
    let proposalPda: PublicKey;
    let proposalId: anchor.BN;
    let vote1Pda: PublicKey;
    let vote2Pda: PublicKey;

    before(async () => {
      // Create a new proposal for voting tests
      const governanceConfig = await program.account.governanceConfig.fetch(governanceConfigPda);
      proposalId = governanceConfig.proposalCounter;

      [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      [vote1Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          member1.publicKey.toBuffer(),
        ],
        program.programId
      );

      [vote2Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          member2.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Create proposal for voting
      await program.methods
        .createProposal(
          "Voting Test Proposal",
          "This is a test proposal for testing the voting functionality of the governance system.",
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

    it("Should cast yes vote successfully", async () => {
      const voteType = { yes: {} };

      await program.methods
        .castVote(proposalId, voteType)
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

      // Verify vote was recorded
      const vote = await program.account.vote.fetch(vote1Pda);
      expect(vote.proposalId.toString()).to.equal(proposalId.toString());
      expect(vote.voter.toString()).to.equal(member1.publicKey.toString());
      expect(vote.voteType).to.deep.equal(voteType);
      expect(vote.votingPower.toString()).to.equal("1000000000000"); // 1000 tokens * 10^9

      // Verify proposal vote counts updated
      const proposal = await program.account.proposal.fetch(proposalPda);
      expect(proposal.yesVotes.toString()).to.equal("1000000000000");
      expect(proposal.totalVotes.toString()).to.equal("1000000000000");
    });

    it("Should cast no vote successfully", async () => {
      const voteType = { no: {} };

      await program.methods
        .castVote(proposalId, voteType)
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

      // Verify vote was recorded
      const vote = await program.account.vote.fetch(vote2Pda);
      expect(vote.voteType).to.deep.equal(voteType);
      expect(vote.votingPower.toString()).to.equal("1500000000000"); // 1500 tokens * 10^9

      // Verify proposal vote counts updated
      const proposal = await program.account.proposal.fetch(proposalPda);
      expect(proposal.yesVotes.toString()).to.equal("1000000000000");
      expect(proposal.noVotes.toString()).to.equal("1500000000000");
      expect(proposal.totalVotes.toString()).to.equal("2500000000000");
    });

    it("Should fail to vote twice", async () => {
      try {
        await program.methods
          .castVote(proposalId, { yes: {} })
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

        expect.fail("Should have failed with account already exists");
      } catch (error) {
        expect(error.toString()).to.include("already in use");
      }
    });

    it("Should fail to vote by non-committee member", async () => {
      const [nonMemberVotePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          proposalId.toArrayLike(Buffer, "le", 8),
          nonMember.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .castVote(proposalId, { yes: {} })
          .accounts({
            proposal: proposalPda,
            vote: nonMemberVotePda,
            governanceConfig: governanceConfigPda,
            voter: nonMember.publicKey,
            voterTokenAccount: authorityTokenAccount, // Using authority's account
            committeeTokenMint: committeeTokenMint,
            systemProgram: SystemProgram.programId,
          })
          .signers([nonMember])
          .rpc();

        expect.fail("Should have failed with NotCommitteeMember");
      } catch (error) {
        expect(error.toString()).to.include("NotCommitteeMember");
      }
    });
  });
});
