Feature: General Ledger and Accounts
  As an employee, I want to view ledger entries and account balances.

  Background:
    Given the register is open via the API with 200

  Scenario: View ledger entries
    Given I am on the Ledger page
    Then I see the ledger entries section

  Scenario: View account balances
    Given I am on the Ledger page
    When I switch to the Balances tab
    Then I see the balances section
    And the cash account is visible

  Scenario: View items in a sale ledger entry
    Given there is a paid order via the API with "Espresso"
    And I am on the Ledger page
    When I expand the first sale entry
    Then I see item rows for that entry

  Scenario: At-cost tab payment shows COST badge in ledger
    Given there is a paid at-cost tab via the API
    And I am on the Ledger page
    Then I see a COST badge on the tab payment entry

  Scenario: Admin sees account adjustment form in Balances tab
    Given I am on the Ledger page
    When I switch to the Balances tab
    Then I see the account adjustment form
    And the adjustment account selector is visible
    And the adjustment submit button is visible
