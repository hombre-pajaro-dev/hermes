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

  Scenario: Record a payroll payment
    Given I am on the Ledger page
    When I switch to the Payroll tab
    And I enter payroll amount 500
    And I enter payroll description "Weekly payroll"
    And I click Record Payroll
    Then I see a success message

  Scenario: View items in a sale ledger entry
    Given there is a paid order via the API with "Espresso"
    And I am on the Ledger page
    When I expand the first sale entry
    Then I see item rows for that entry
