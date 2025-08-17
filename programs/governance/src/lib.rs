pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("9GqiBXHh7e5gREwHU6PKHDaQsLuYfqHQ2az2sBLXdaTv");

#[program]
pub mod governance {
    use super::*;

    /// Initialize governance system
    pub fn initialize_governance(
        ctx: Context<InitializeGovernance>,
        proposal_deposit: u64,
        voting_period: u64,
        participation_threshold: u16,
        approval_threshold: u16,
        veto_threshold: u16,
        fee_rate: u16,
        test_mode: bool,
    ) -> Result<()> {
        instructions::initialize_governance(
            ctx,
            proposal_deposit,
            voting_period,
            participation_threshold,
            approval_threshold,
            veto_threshold,
            fee_rate,
            test_mode,
        )
    }

    /// Update governance configuration
    pub fn update_governance_config(
        ctx: Context<UpdateGovernanceConfig>,
        config_update: GovernanceConfigUpdate,
    ) -> Result<()> {
        instructions::update_governance_config(ctx, config_update)
    }

    /// Update total voting power
    pub fn update_total_voting_power(
        ctx: Context<UpdateTotalVotingPower>,
        new_total_voting_power: u64,
    ) -> Result<()> {
        instructions::update_total_voting_power(ctx, new_total_voting_power)
    }

    /// Update proposal counter (admin only)
    pub fn update_proposal_counter(
        ctx: Context<UpdateProposalCounter>,
        new_counter: u64,
    ) -> Result<()> {
        instructions::update_proposal_counter(ctx, new_counter)
    }

    // ==================== Rule Management Instructions ====================

    /// Create rule registry
    pub fn create_rule_registry(ctx: Context<CreateRuleRegistry>) -> Result<()> {
        instructions::create_rule_registry(ctx)
    }

    /// Add rule document
    pub fn add_rule_document(
        ctx: Context<AddRuleDocument>,
        category: String,
        title: String,
        url: String,
        hash: String,
    ) -> Result<()> {
        instructions::add_rule_document(ctx, category, title, url, hash)
    }

    /// Update rule document
    pub fn update_rule_document(
        ctx: Context<UpdateRuleDocument>,
        document_index: u32,
        new_url: Option<String>,
        new_hash: Option<String>,
    ) -> Result<()> {
        instructions::update_rule_document(ctx, document_index, new_url, new_hash)
    }

    /// Remove rule document
    pub fn remove_rule_document(
        ctx: Context<RemoveRuleDocument>,
        document_index: u32,
    ) -> Result<()> {
        instructions::remove_rule_document(ctx, document_index)
    }

    /// Get rule documents information
    pub fn get_rule_documents(ctx: Context<GetRuleDocuments>) -> Result<Vec<RuleDocument>> {
        instructions::get_rule_documents(ctx)
    }

    /// Verify rule document hash
    pub fn verify_rule_document(
        ctx: Context<VerifyRuleDocument>,
        document_index: u32,
        expected_hash: String,
    ) -> Result<bool> {
        instructions::verify_rule_document(ctx, document_index, expected_hash)
    }

    /// Find rule documents by category
    pub fn find_documents_by_category(
        ctx: Context<GetRuleDocuments>,
        category: String,
    ) -> Result<Vec<RuleDocument>> {
        instructions::find_documents_by_category(ctx, category)
    }

    // ==================== Committee Member Management Instructions ====================

    /// Add committee member
    pub fn add_committee_member(ctx: Context<AddCommitteeMember>, member: Pubkey) -> Result<()> {
        instructions::add_committee_member(ctx, member)
    }

    /// Remove committee member
    pub fn remove_committee_member(
        ctx: Context<RemoveCommitteeMember>,
        member: Pubkey,
    ) -> Result<()> {
        instructions::remove_committee_member(ctx, member)
    }

    /// Close governance configuration
    pub fn close_governance_config(ctx: Context<CloseGovernanceConfig>) -> Result<()> {
        instructions::close_governance_config(ctx)
    }

    // ==================== Proposal Management Instructions ====================

    /// Create proposal
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description: String,
        proposal_type: ProposalType,
        execution_data: Option<ExecutionData>,
        custom_deposit_raw: Option<u64>,
    ) -> Result<u64> {
        instructions::create_proposal(
            ctx,
            title,
            description,
            proposal_type,
            execution_data,
            custom_deposit_raw,
        )
    }

    /// Cast vote
    pub fn cast_vote(ctx: Context<CastVote>, proposal_id: u64, vote_type: VoteType) -> Result<()> {
        instructions::cast_vote(ctx, proposal_id, vote_type)
    }

    /// Finalize proposal
    pub fn finalize_proposal<'info>(
        ctx: Context<'_, '_, 'info, 'info, FinalizeProposal<'info>>,
        proposal_id: u64,
    ) -> Result<()> {
        instructions::finalize_proposal(ctx, proposal_id)
    }

    /// Close vote account
    pub fn close_vote(ctx: Context<CloseVote>) -> Result<()> {
        instructions::close_vote(ctx)
    }

    /// Execute proposal (simplified version)
    pub fn execute_proposal(ctx: Context<ExecuteProposal>, proposal_id: u64) -> Result<()> {
        instructions::execute_proposal(ctx, proposal_id)
    }

    // ==================== Query Instructions ====================

    /// Query voting power and statistics for a proposal
    pub fn query_voting_power<'info>(
        ctx: Context<'_, '_, 'info, 'info, QueryVotingPower<'info>>,
        proposal_id: u64,
    ) -> Result<()> {
        instructions::query_voting_power(ctx, proposal_id)
    }

    // ==================== Deposit Management Instructions ====================

    /// Initialize governance system token vault
    pub fn initialize_token_vault(ctx: Context<InitializeTokenVault>) -> Result<()> {
        instructions::initialize_token_vault(ctx)
    }
}
