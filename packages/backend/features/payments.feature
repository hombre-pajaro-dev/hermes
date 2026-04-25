Feature: Payments
  As an admin, I want to record weekly payments for staff and expenses so that they are tracked in the ledger.

  Background:
    Given the register is open with opening cash 200

  Scenario: List payees returns default payees
    When I GET /api/payees
    Then the response status is 200
    And the response includes a payee named "Pajaro"
    And the response includes a payee named "Rent"
    And the response includes a payee named "Savings"

  Scenario: Create a new payee
    When I POST /api/payees with name "NewPayee" type "expense"
    Then the response status is 201
    And I GET /api/payees
    And the response includes a payee named "NewPayee"

  Scenario: Deactivate a payee
    Given there is a payee "TempPayee" of type "staff"
    When I PATCH the payee with active false
    Then the response status is 200
    And the payee "TempPayee" is inactive

  Scenario: Run a payment creates payroll ledger entry
    Given there is a payee "TestStaff" of type "staff"
    When I POST /api/payments/run with the payee amount 100 from "cash"
    Then the response status is 201
    And a ledger entry exists for "TestStaff" with amount -100 and type "payroll"

  Scenario: Run a payment creates expense ledger entry
    Given there is a payee "TestRent" of type "expense"
    When I POST /api/payments/run with the payee amount 500 from "cash"
    Then the response status is 201
    And a ledger entry exists for "TestRent" with amount -500 and type "expense"

  Scenario: Run a payment creates savings transfer ledger entry
    Given there is a payee "TestSavings" of type "savings"
    When I POST /api/payments/run with the payee amount 200 from "cash"
    Then the response status is 201
    And a ledger entry exists for "TestSavings" with amount -200 and type "savings_transfer"

  Scenario: Update payee default weight
    Given there is a payee "WeightedStaff" of type "staff"
    When I PATCH the payee default_weight to 3
    Then the response status is 200
    And the payee "WeightedStaff" has default_weight 3

  Scenario: Run payments with a note appends note to ledger description
    Given there is a payee "NoteStaff" of type "staff"
    When I POST /api/payments/run with the payee amount 200 from "cash" and note "Week of Apr 14"
    Then the response status is 201
    And a ledger entry exists for "NoteStaff — Week of Apr 14" with amount -200 and type "payroll"
