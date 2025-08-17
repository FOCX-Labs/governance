use anchor_lang::prelude::*;

#[error_code]
pub enum GovernanceError {
    // Governance system initialization errors
    #[msg("Governance system not initialized")]
    GovernanceNotInitialized,
    #[msg("Governance system already initialized")]
    GovernanceAlreadyInitialized,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Unauthorized operation")]
    Unauthorized,

    // Configuration related errors
    #[msg("Invalid threshold value")]
    InvalidThreshold,
    #[msg("Invalid fee rate")]
    InvalidFeeRate,
    #[msg("Invalid voting period")]
    InvalidVotingPeriod,
    #[msg("Math overflow")]
    MathOverflow,

    // Proposal related errors
    #[msg("Proposal not found")]
    ProposalNotFound,
    #[msg("Invalid proposal type")]
    InvalidProposalType,
    #[msg("Proposal not active")]
    ProposalNotActive,
    #[msg("Proposal not executable")]
    ProposalNotExecutable,
    #[msg("Voting period ended")]
    VotingPeriodEnded,
    #[msg("Voting period not ended")]
    VotingPeriodNotEnded,
    #[msg("Invalid proposal title length")]
    InvalidProposalTitleLength,
    #[msg("Invalid proposal description length")]
    InvalidProposalDescriptionLength,
    #[msg("Insufficient proposal deposit")]
    InsufficientProposalDeposit,
    #[msg("Proposal not finalized")]
    ProposalNotFinalized,
    #[msg("Proposal not vetoed")]
    ProposalNotVetoed,

    // Voting related errors
    #[msg("Already voted")]
    AlreadyVoted,
    #[msg("Vote not found")]
    VoteNotFound,
    #[msg("Vote already revoked")]
    VoteAlreadyRevoked,
    #[msg("Insufficient voting power")]
    InsufficientVotingPower,
    #[msg("Invalid vote type")]
    InvalidVoteType,
    #[msg("Cannot revoke vote")]
    CannotRevokeVote,

    // Committee member management errors
    #[msg("Committee is full")]
    CommitteeFull,
    #[msg("Member already exists")]
    MemberAlreadyExists,
    #[msg("Member not found")]
    MemberNotFound,
    #[msg("Not a committee member")]
    NotCommitteeMember,

    // Rule management errors
    #[msg("Rule registry not found")]
    RuleRegistryNotFound,
    #[msg("Rule document not found")]
    RuleDocumentNotFound,
    #[msg("Duplicate rule document")]
    DuplicateRuleDocument,
    #[msg("Too many rule documents")]
    TooManyRuleDocuments,
    #[msg("Invalid category length")]
    InvalidCategoryLength,
    #[msg("Invalid title length")]
    InvalidTitleLength,
    #[msg("Invalid URL length")]
    InvalidUrlLength,
    #[msg("Invalid hash length")]
    InvalidHashLength,
    #[msg("Invalid URL format")]
    InvalidUrlFormat,
    #[msg("Invalid hash format")]
    InvalidHashFormat,

    // Slash proposal errors
    #[msg("Invalid merchant address")]
    InvalidMerchantAddress,
    #[msg("Product not found")]
    ProductNotFound,
    #[msg("Order not found")]
    OrderNotFound,
    #[msg("Invalid violation type")]
    InvalidViolationType,
    #[msg("Too many evidence URLs")]
    TooManyEvidenceUrls,
    #[msg("Invalid slash amount")]
    InvalidSlashAmount,

    // Dispute arbitration errors
    #[msg("Invalid dispute parties")]
    InvalidDisputeParties,
    #[msg("Not authorized for dispute")]
    NotAuthorizedForDispute,
    #[msg("Invalid dispute type")]
    InvalidDisputeType,
    #[msg("Invalid resolution request")]
    InvalidResolutionRequest,
    #[msg("Order not in dispute")]
    OrderNotInDispute,

    // Token related errors
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Insufficient token balance")]
    InsufficientTokenBalance,
    #[msg("Token transfer failed")]
    TokenTransferFailed,
    #[msg("Invalid token account")]
    InvalidTokenAccount,

    // Mathematical operation errors
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Arithmetic underflow")]
    ArithmeticUnderflow,
    #[msg("Division by zero")]
    DivisionByZero,

    // Time related errors
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
    #[msg("Deadline exceeded")]
    DeadlineExceeded,
    #[msg("Too early")]
    TooEarly,

    // Account related errors
    #[msg("Invalid account owner")]
    InvalidAccountOwner,
    #[msg("Invalid account data")]
    InvalidAccountData,
    #[msg("Account not initialized")]
    AccountNotInitialized,
    #[msg("Account already initialized")]
    AccountAlreadyInitialized,
    #[msg("Invalid PDA")]
    InvalidPda,
    #[msg("Invalid account seeds")]
    InvalidAccountSeeds,

    // Execution related errors
    #[msg("Execution failed")]
    ExecutionFailed,
    #[msg("Invalid execution data")]
    InvalidExecutionData,
    #[msg("CPI call failed")]
    CpiCallFailed,

    // General errors
    #[msg("Invalid input")]
    InvalidInput,
    #[msg("Operation not allowed")]
    OperationNotAllowed,
    #[msg("Feature not implemented")]
    FeatureNotImplemented,
}
