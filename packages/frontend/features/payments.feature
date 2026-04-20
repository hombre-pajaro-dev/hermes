Feature: Payments
  As an admin, I want to record weekly payments so that staff and expenses are tracked in the ledger.

  Background:
    Given the register is open via the API with 200

  Scenario: Payment creates a payroll ledger entry
    Given a payment is recorded via the API for "Pajaro" amount 150 from "cash" type "staff"
    When I am on the Ledger page
    Then I see a payroll entry in the ledger

  Scenario: Payment creates an expense ledger entry
    Given a payment is recorded via the API for "Rent" amount 800 from "cash" type "expense"
    When I am on the Ledger page
    Then I see an expense entry in the ledger

  Scenario: Payment creates a savings transfer ledger entry
    Given a payment is recorded via the API for "Savings" amount 300 from "cash" type "savings"
    When I am on the Ledger page
    Then I see a savings transfer entry in the ledger
