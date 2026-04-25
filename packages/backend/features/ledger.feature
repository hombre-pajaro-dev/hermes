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

  Scenario: View items for a sale ledger entry
    When I create an order with items
      | product_name | quantity |
      | Espresso     | 2        |
    And I pay the order with card
    And I fetch the ledger
    Then the sale ledger entry has items
    And the sale items include "Espresso" with quantity 2

  Scenario: View items for a tab payment ledger entry
    When I open a new tab named "Table 1"
    And I add items to the tab
      | product_name | quantity |
      | Latte        | 1        |
    And I pay the tab with card
    And I fetch the ledger
    Then the tab_payment ledger entry has items
    And the tab payment items include "Latte" with quantity 1

  Scenario: Ledger entry includes discount info when a discount was applied
    Given a 20% discount named "Happy Hour" exists
    When I create an order with items
      | product_name | quantity |
      | Espresso     | 2        |
    And I pay the order with card and discount "Happy Hour"
    And I fetch the ledger
    Then the sale ledger entry has discount_name "Happy Hour"
    And the sale ledger entry discount_amount is greater than 0

  Scenario: Tab payment entry for at-cost tab includes tab_at_cost flag
    When I open an at-cost tab named "Staff Tab"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 1        |
    And I pay the tab with card
    And I fetch the ledger
    Then the tab_payment entry has tab_at_cost set to true

  Scenario: Tab payment entry includes tab_opened_by field
    When I open a new tab named "Track Tab"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 1        |
    And I pay the tab with card
    And I fetch the ledger
    Then the tab_payment entry has a tab_opened_by field

  Scenario: Admin can add money to an account via adjustment
    When I post an account adjustment of 100.00 to "cash" with description "Cash deposit"
    And I fetch the ledger
    Then there is an "account_adjustment" ledger entry with account "cash" and amount 100.00

  Scenario: Admin can remove money from an account via adjustment
    When I post an account adjustment of -50.00 to "credit_card" with description "Card correction"
    And I fetch the ledger
    Then there is an "account_adjustment" ledger entry with account "credit_card" and amount -50.00
