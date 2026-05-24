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

  Scenario: List all register sessions
    Given the register is open with opening cash 200
    When I fetch the register sessions list
    Then the sessions list is an array
    And the sessions list has at least 1 entry

  Scenario: Session report contains orders-only sales
    Given the register is open with opening cash 200
    And I have sold items
      | product_name | quantity | payment |
      | Espresso     | 2        | cash    |
    When I fetch the session report for the current session
    Then the session report has order_count at least 1
    And the session report has positive revenue
    And the session report has a by_item array

  Scenario: Session report excludes tab sales
    Given the register is open with opening cash 200
    And I open a new tab and pay it
    When I fetch the session report for the current session
    Then the session report has order_count of 0

  Scenario: Opening register captures inventory snapshot
    Given the register is open with opening cash 200
    When I fetch the session report for the current session
    Then the session has an inventory_snapshot_open with products

  Scenario: Closing register captures inventory snapshot
    Given the register is open with opening cash 200
    When I close the register with closing cash 150.00
    And I fetch the session report for the last session
    Then the session has an inventory_snapshot_close with products

  Scenario: Opening register records only the variance against current cash balance
    When I open the register with opening cash 200.00
    And I fetch the ledger
    Then there is a "register_open" ledger entry with amount 200.00

  Scenario: Closing register records zero variance when counted cash matches expected
    Given the register is open with opening cash 200
    When I close the register with closing cash 200.00
    And I fetch the ledger
    Then there is a "register_close" ledger entry with amount 0.00

  Scenario: Closing register records negative variance when cash is short
    Given the register is open with opening cash 200
    When I close the register with closing cash 175.00
    And I fetch the ledger
    Then there is a "register_close" ledger entry with amount -25.00

  Scenario: Closing register records positive variance when cash is over
    Given the register is open with opening cash 200
    When I close the register with closing cash 210.00
    And I fetch the ledger
    Then there is a "register_close" ledger entry with amount 10.00

  Scenario: Session report includes expected_cash and cash_variance
    Given the register is open with opening cash 200
    When I close the register with closing cash 175.00
    And I fetch the session report for the last session
    Then the session report expected_cash is 200.00
    And the session report cash_variance is -25.00

  Scenario: Closing register with physical counts creates inventory adjustments for discrepancies
    Given the register is open with opening cash 200
    When I close the register with closing cash 200.00 and physical count for "Espresso" of 90
    And I fetch the session report for the last session
    Then the session report has an adjustment for "Espresso"

  Scenario: Closing register with physical counts matching system does not create adjustments
    Given the register is open with opening cash 200
    When I close the register with closing cash 200.00 and physical count matching system for "Espresso"
    And I fetch the session report for the last session
    Then the session report has no adjustments

  Scenario: Closing register includes cash from tabs opened in a previous session
    Given the register is open with opening cash 200
    And I open a new tab named "Cross-Session Tab"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 1        |
    When I close the register with closing cash 200.00
    And I open the register with opening cash 200.00
    And I pay the tab with cash amount 9999.00
    And I close the register with closing cash 203.00
    And I fetch the session report for the last session
    Then the session report expected_cash is 203.00
    And the session report cash_variance is 0.00
