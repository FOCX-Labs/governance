pub mod governance;
pub mod proposal;
pub mod rules;
pub mod vote;

// Re-export main structures to avoid naming conflicts
pub use governance::{governance_constants, GovernanceConfig, GovernanceConfigUpdate};
pub use proposal::{
    ArbitrationDecision, ConfigUpdateData, DisputeProposalData, ExecutionData, Proposal,
    ProposalStatus, ProposalType, RuleOperation, RuleUpdateData, SlashProposalData, VoteType,
};
pub use rules::{rule_categories, RuleCategory, RuleDocument, RuleRegistry};
pub use vote::{vote_constants, Vote, VoteDelegation, VoteStats, VotingPowerCalculator};
