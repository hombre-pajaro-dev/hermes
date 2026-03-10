Feature: Register (Open / Close / Cashout)
  As an employee, I want to open and close the POS register and cash out
  so that we track cash in the drawer and can remove excess.

  Scenario: Open the register with starting cash
    When I open the register with opening cash 200.00
    Then the register status is "open"
    And the register opening cash is 200.00
    And the ledger has a "register_open" entry

  Scenario: Cannot open register when already open
    Given the register is open with opening cash 200
    When I try to open the register with opening cash 100.00
    Then the response status is 409
    And the response error mentions "already open"

  Scenario: Cash out from the register
    Given the register is open with opening cash 200
    When I cash out 50.00 with reason "Safe drop"
    Then the cashout is recorded with amount 50.00
    And the ledger has a "cashout" entry

  Scenario: Close the register and get day brief
    Given the register is open with opening cash 200
    When I close the register with closing cash 175.00
    Then the register status is "closed"
    And the ledger has a "register_close" entry
    And the close brief has a revenue field
    And the close brief has a total_cost field

  Scenario: Cannot close without closing_cash
    Given the register is open with opening cash 200
    When I try to close the register without closing cash
    Then the response status is 400
    And the response error mentions "closing_cash"
