use anchor_lang::prelude::*;

use crate::error::GovernanceError;
use crate::instructions::common::*;
use crate::state::*;

/// Create rule registry
#[derive(Accounts)]
pub struct CreateRuleRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + RuleRegistry::INIT_SPACE, // Initially empty
        seeds = [RULE_REGISTRY_SEED],
        bump
    )]
    pub rule_registry: Account<'info, RuleRegistry>,

    /// Governance configuration account for permission verification
    #[account(
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can create rule registry
    #[account(
        mut,
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Create rule registry handler
pub fn create_rule_registry(ctx: Context<CreateRuleRegistry>) -> Result<()> {
    let rule_registry = &mut ctx.accounts.rule_registry;
    let clock = Clock::get()?;

    rule_registry.authority = ctx.accounts.governance_config.authority;
    rule_registry.rule_documents = Vec::new();
    rule_registry.last_updated = clock.unix_timestamp;
    rule_registry.version = 1;
    rule_registry.created_at = clock.unix_timestamp;
    rule_registry.bump = ctx.bumps.rule_registry;

    msg!("Rule registry created successfully");
    Ok(())
}

/// Add rule document
#[derive(Accounts)]
#[instruction(category: String, title: String, url: String, hash: String)]
pub struct AddRuleDocument<'info> {
    #[account(
        mut,
        seeds = [RULE_REGISTRY_SEED],
        bump = rule_registry.bump,
        realloc = 8 + RuleRegistry::INIT_SPACE,
        realloc::payer = authority,
        realloc::zero = false
    )]
    pub rule_registry: Account<'info, RuleRegistry>,

    /// Governance configuration account for permission verification
    #[account(
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can add rule documents
    #[account(
        mut,
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Add rule document handler
pub fn add_rule_document(
    ctx: Context<AddRuleDocument>,
    category: String,
    title: String,
    url: String,
    hash: String,
) -> Result<()> {
    let rule_registry = &mut ctx.accounts.rule_registry;

    // Create new rule document
    let document = RuleDocument::new(category, title, url, hash)?;

    // Validate URL and hash format using common functions
    require!(
        validate_url(&document.url),
        GovernanceError::InvalidUrlFormat
    );
    require!(
        validate_hash(&document.hash),
        GovernanceError::InvalidHashFormat
    );

    // Add document to registry
    rule_registry.add_document(document)?;

    msg!(
        "Rule document added successfully, version: {}",
        rule_registry.version
    );
    Ok(())
}

/// Update rule document
#[derive(Accounts)]
#[instruction(document_index: u32)]
pub struct UpdateRuleDocument<'info> {
    #[account(
        mut,
        seeds = [RULE_REGISTRY_SEED],
        bump = rule_registry.bump
    )]
    pub rule_registry: Account<'info, RuleRegistry>,

    /// Governance configuration account for permission verification
    #[account(
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can update rule documents
    #[account(
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

/// Update rule document handler
pub fn update_rule_document(
    ctx: Context<UpdateRuleDocument>,
    document_index: u32,
    new_url: Option<String>,
    new_hash: Option<String>,
) -> Result<()> {
    let rule_registry = &mut ctx.accounts.rule_registry;

    // Validate new URL and hash format using common functions
    if let Some(ref url) = new_url {
        require!(validate_url(url), GovernanceError::InvalidUrlFormat);
    }

    if let Some(ref hash) = new_hash {
        require!(validate_hash(hash), GovernanceError::InvalidHashFormat);
    }

    // Update document
    rule_registry.update_document(document_index as usize, new_url, new_hash)?;

    msg!(
        "Rule document updated successfully, version: {}",
        rule_registry.version
    );
    Ok(())
}

/// Remove rule document
#[derive(Accounts)]
#[instruction(document_index: u32)]
pub struct RemoveRuleDocument<'info> {
    #[account(
        mut,
        seeds = [RULE_REGISTRY_SEED],
        bump = rule_registry.bump,
        realloc = 8 + RuleRegistry::INIT_SPACE,
        realloc::payer = authority,
        realloc::zero = false
    )]
    pub rule_registry: Account<'info, RuleRegistry>,

    /// Governance configuration account for permission verification
    #[account(
        seeds = [GOVERNANCE_CONFIG_SEED],
        bump = governance_config.bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    /// Only administrator can remove rule documents
    #[account(
        mut,
        constraint = authority.key() == governance_config.authority @ GovernanceError::Unauthorized
    )]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Remove rule document handler
pub fn remove_rule_document(ctx: Context<RemoveRuleDocument>, document_index: u32) -> Result<()> {
    let rule_registry = &mut ctx.accounts.rule_registry;

    // Remove document
    rule_registry.remove_document(document_index as usize)?;

    msg!(
        "Rule document removed successfully, version: {}",
        rule_registry.version
    );
    Ok(())
}

/// Get rule documents information
#[derive(Accounts)]
pub struct GetRuleDocuments<'info> {
    #[account(
        seeds = [RULE_REGISTRY_SEED],
        bump = rule_registry.bump
    )]
    pub rule_registry: Account<'info, RuleRegistry>,
}

/// Get rule documents information handler
pub fn get_rule_documents(ctx: Context<GetRuleDocuments>) -> Result<Vec<RuleDocument>> {
    let rule_registry = &ctx.accounts.rule_registry;
    Ok(rule_registry.rule_documents.clone())
}

/// Verify rule document hash
#[derive(Accounts)]
pub struct VerifyRuleDocument<'info> {
    #[account(
        seeds = [RULE_REGISTRY_SEED],
        bump = rule_registry.bump
    )]
    pub rule_registry: Account<'info, RuleRegistry>,
}

/// Verify rule document hash handler
pub fn verify_rule_document(
    ctx: Context<VerifyRuleDocument>,
    document_index: u32,
    expected_hash: String,
) -> Result<bool> {
    let rule_registry = &ctx.accounts.rule_registry;
    let is_valid = rule_registry.verify_document_hash(document_index as usize, &expected_hash);

    msg!("Document hash verification result: {}", is_valid);
    Ok(is_valid)
}

/// Find rule documents by category
pub fn find_documents_by_category(
    ctx: Context<GetRuleDocuments>,
    category: String,
) -> Result<Vec<RuleDocument>> {
    let rule_registry = &ctx.accounts.rule_registry;
    let documents = rule_registry.find_documents_by_category(&category);
    Ok(documents.into_iter().cloned().collect())
}
