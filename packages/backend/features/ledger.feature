Feature: General Ledger and Accounts
  As an employee or admin, I want the system to record all orders and events
  by timestamp and track money per account (cash, credit card), and record
  payroll, so that we have a full audit trail and account balances.

  Background:
    Given the register is open with opening cash 200

  Scenario: Ledger records a sale with timestamp and account
    When I create an order with items
      | product_name | quantity |
      | Espresso     | 1        |
    And I pay the order with card
    And I fetch the ledger
    Then there is a "sale" ledger entry with account "credit_card"
    And the sale entry has a non-zero amount

  Scenario: View account balances
    When I create an order with items
      | product_name | quantity |
      | Latte        | 1        |
    And I pay the order with cash amount 10.00
    And I fetch the account balances
    Then the "cash" account balance is positive
    And the "credit_card" account is present in balances

  Scenario: Record a payroll payment from an account
    When I record payroll of 500.00 from "cash" with description "Weekly payroll"
    And I fetch the ledger
    Then there is a "payroll" ledger entry with amount -500.00
    And the ledger payroll entry account is "cash"

  Scenario: Ledger entries are ordered by timestamp
    When I create an order with items
      | product_name | quantity |
      | Espresso     | 1        |
    And I pay the order with card
    And I create an order with items
      | product_name | quantity |
      | Croissant    | 1        |
    And I pay the order with cash amount 10.00
    And I fetch the ledger
    Then the ledger entries are ordered by created_at descending

  Scenario: List accounts
    When I fetch the accounts list
    Then the accounts list includes "cash"
    And the accounts list includes "credit_card"
