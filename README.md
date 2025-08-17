# The governance module of FOCX

The govenance module mainly provide the functionalities of punishing illegal merchants or users and arbitrating controversial transactions. It also publicly notices the platform rules, which will be stored on a decentralized storage service.

Any user can create 2 types of proposals: 
- Slash. If anyone finds that a merchant has posted illegal goods.
- Dispute. If there is a dispute between the user and the merchant regarding a transaction

Any proposal submission must be accompanied by a deposit of at least 100 USDC. Then, committee members will vote, with the number of Governance tokens held by each member determining their voting power. There are several voting options: Yes, No, Abstain and No With Veto. The voting period is 14 days. A proposal passes if, within 14 days, more than 40% of the voting power participates in the vote and more than 50% of the participating voting power votes Yes. Otherwise, the proposal fails. If the proposal passes, 90% of the deposit is returned to the proposer, and 10% goes to the committee as a fee. If more than 30% of the participating voting power votes No With Veto (e.g., in cases of spam ads), the proposal is rejected, and the full 100% deposit will be forfeited by the committee.

## Quick start
### Requirement
 - anchor 0.31.1
### Build
```bash
anchor build
```
### Deploy
```bash
anchor deploy
```