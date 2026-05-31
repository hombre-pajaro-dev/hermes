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

  Scenario: Run a payment with session_id appears in the session report
    Given there is a payee "SessionStaff" of type "staff"
    When I close the register with closing cash 200.00
    And I POST /api/payments/run with the payee amount 100 from "cash" for the last closed session
    And I fetch the session report for the last session
    Then the session report payments include "SessionStaff" with amount -100

  Scenario: Payment run without explicit session_id auto-links to the open session
    Given there is a payee "AutoLinkStaff" of type "staff"
    When I POST /api/payments/run with the payee amount 75 from "cash"
    And I close the register with closing cash 200.00
    And I fetch the session report for the last session
    Then the session report payments include "AutoLinkStaff" with amount -75

  Scenario: Run a savings payment also credits the savings account
    Given there is a payee "TestSavings2" of type "savings"
    When I POST /api/payments/run with the payee amount 200 from "digital"
    Then the response status is 201
    And a ledger entry exists for "TestSavings2" with amount 200 and type "savings_transfer"

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

  Scenario: Ad-hoc provider payment creates expense ledger entry
    Given a provider named "AdHocProv" exists
    When I POST a provider payment of 75.00 from "cash"
    Then the response status is 201
    And a ledger entry exists for "Provider payment: AdHocProv" with amount -75.00 and type "expense"

  Scenario: Ad-hoc provider payment with custom description uses custom description
    Given a provider named "CustomDescProv" exists
    When I POST a provider payment of 40.00 from "digital" with description "Monthly fee"
    Then the response status is 201
    And a ledger entry exists for "Monthly fee" with amount -40.00 and type "expense"

  Scenario: Set product provider links untracked product to provider
    Given a provider named "LinkProv" exists
    When I PATCH the product "Espresso" provider to "LinkProv"
    Then the response status is 200
    And the product "Espresso" has provider_id set

  Scenario: Session bill returns untracked product sales per provider
    Given a provider named "BillCo" exists
    And the product "Espresso" is untracked and linked to provider "BillCo"
    And I sell 2 units of "Espresso"
    When I fetch the session bill for today
    Then the response status is 200
    And the session bill includes provider "BillCo"
    And the session bill entry for "BillCo" has qty_sold at least 2

  Scenario: Session bill returns empty array when no provider-linked untracked sales
    When I fetch the session bill for today
    Then the response status is 200
    And the session bill is empty

  Scenario: Card payment auto-applies commission ledger entries
    Given a product "Espresso" costs 3.00 and sells for 5.00 with 10 units
    When I create and pay an order for 2x "Espresso" with card
    Then a commission_transfer ledger entry exists on account "digital"
    And a commission ledger entry exists on account "commissions"

  Scenario: Cash payment does not create commission entries
    Given a product "Espresso" costs 3.00 and sells for 5.00 with 10 units
    When I create and pay an order for 2x "Espresso" with cash
    Then no commission ledger entry exists for the order

  Scenario: Commission rate is configurable
    When I PATCH /api/admin/commissions with rate 0.05
    Then the response status is 200
    And the commission rate is 0.05
