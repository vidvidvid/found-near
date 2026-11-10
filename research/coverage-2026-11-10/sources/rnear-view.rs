use crate::*;

#[near(serializers = [json])]
pub struct Summary {
    /// Total amount of LST that was minted (minus burned).
    pub total_share_amount: U128,
    /// Total amount of NEAR that was staked by users to this contract.
    pub total_staked_near_amount: U128,

    /// LST price
    pub ft_price: U128,

    /// Number of nodes in validator pool
    pub validators_num: u32,

    /// Amount of NEAR that needs to be settled by staking on validators
    pub stake_amount_to_settle: U128,
    /// Amount of NEAR that needs to be settled by unstaking from validators
    pub unstake_amount_to_settle: U128,
    /// Total base stake amount of NEAR on validators
    pub validators_total_base_stake_amount: U128,
    /// Amount of NEAR that is requested to stake by all users during the last epoch
    pub epoch_requested_stake_amount: U128,
    /// Amount of NEAR that is requested to unstake by all users during the last epoch
    pub epoch_requested_unstake_amount: U128,
}

#[near]
impl Contract {
    pub fn ft_price(&self) -> U128 {
        self.staked_amount_from_num_shares_rounded_down(ONE_NEAR)
            .into()
    }

    pub fn get_beneficiaries(&self) -> HashMap<AccountId, u32> {
        self.internal_get_beneficiaries()
    }

    pub fn get_summary(&self) -> Summary {
        Summary {
            total_share_amount: self.data().token.total_supply.into(),
            total_staked_near_amount: self.data().total_staked_near_amount.into(),
            ft_price: self.ft_price(),
            validators_num: self.data().validator_pool.count(),
            stake_amount_to_settle: self.data().stake_amount_to_settle.into(),
            unstake_amount_to_settle: self.data().unstake_amount_to_settle.into(),
            validators_total_base_stake_amount: self
                .data()
                .validator_pool
                .total_base_stake_amount
                .into(),
            epoch_requested_stake_amount: self.data().epoch_requested_stake_amount.into(),
            epoch_requested_unstake_amount: self.data().epoch_requested_unstake_amount.into(),
        }
    }

    pub fn get_account_details(&self, account_id: AccountId) -> AccountDetailsView {
        let account = self.internal_get_account(&account_id);
        AccountDetailsView {
            unstaked_balance: account.unstaked.into(),
            staked_balance: self
                .staked_amount_from_num_shares_rounded_down(
                    self.data().token.accounts.get(&account_id).unwrap_or(0),
                )
                .into(),
            unstaked_available_epoch_height: account.unstaked_available_epoch_height,
            can_withdraw: account.unstaked_available_epoch_height <= get_epoch_height(),
            account_id,
        }
    }

    pub fn can_account_withdraw(&self, account_id: AccountId, amount: U128) {
        self.assert_can_withdraw(&account_id, amount.0);
    }

    pub fn get_total_weight(&self) -> u16 {
        self.data().validator_pool.total_weight
    }

    pub fn get_validator(&self, validator_id: AccountId) -> ValidatorInfo {
        self.data()
            .validator_pool
            .get_validator(&validator_id)
            .expect(ERR_VALIDATOR_NOT_EXIST)
            .get_info(
                &self.data().validator_pool,
                self.data().total_staked_near_amount,
            )
    }

    pub fn get_validators(
        &self,
        from_index: Option<usize>,
        limit: Option<usize>,
    ) -> Vec<ValidatorInfo> {
        self.data()
            .validator_pool
            .get_validators(from_index, limit)
            .iter()
            .map(|v| {
                v.get_info(
                    &self.data().validator_pool,
                    self.data().total_staked_near_amount,
                )
            })
            .collect()
    }
}
