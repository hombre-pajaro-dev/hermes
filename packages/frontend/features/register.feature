Feature: Register
  As an employee, I want to open and close the POS register and cash out.

  Scenario: Open the register with starting cash
    Given I am on the Register page
    Then the register status shows as closed
    When I fill in opening cash as 200
    And I click Open Register
    Then I see a success message
    And the register shows as open

  Scenario: Cannot open register when already open
    Given the register is open via the API with 100
    And I am on the Register page
    Then the open register form is not visible

  Scenario: Cash out from the register
    Given the register is open via the API with 200
    And I am on the Register page
    When I fill in cashout amount as 50
    And I fill in cashout reason as "Safe drop"
    And I click Cash Out
    And I confirm with PIN "1234"
    Then I see a success message

  Scenario: Close the register
    Given the register is open via the API with 200
    And I am on the Register page
    When I fill in closing cash as 175
    And I click Close Register
    And I confirm with PIN "1234"
    Then I see a success message
    And the register shows as closed

  Scenario: Cannot close without closing cash
    Given the register is open via the API with 200
    And I am on the Register page
    Then the close register button is disabled

  # ── Close Reconciliation (single-step) ───────────────────────────────────────

  Scenario: Close form shows digital balance input
    Given the register is open via the API with 200
    And I am on the Register page
    Then the actual digital balance input is visible in the close form

  Scenario: Close form shows physical count inputs for products sold this session
    Given the register is open via the API with 200
    And Espresso has been sold in the current session
    And I am on the Register page
    Then the close form shows a physical count input for "Espresso"

  Scenario: Close form does not show count inputs for products with no session activity
    Given the register is open via the API with 200
    And I am on the Register page
    Then the close form does not show a physical count input for "Croissant"

  Scenario: Submitting close with all reconciliation fields closes the session
    Given the register is open via the API with 200
    And Espresso has been sold in the current session
    And I am on the Register page
    When I fill in closing cash as 200
    And I fill in actual digital balance as 0
    And I fill in physical count for "Espresso" as 95
    And I click Close Register
    And I confirm with PIN "1234"
    Then I see a success message
    And the register shows as closed

  Scenario: Session report shows reconciliation narrative after single-step close
    Given the register is open via the API with 200
    And Espresso has been sold in the current session
    And I have closed the register with cash 200 digital 0 and physical count for "Espresso" of 95
    When I navigate to the session report
    Then the reconciliation narrative is visible
    And the reconciliation narrative shows a net variance

  Scenario: Narrative shows net OK when cash collected matches expected
    Given a closed session with cash balanced and no inventory variance
    When I navigate to the session report
    Then the reconciliation narrative net status is "OK"

  Scenario: Narrative flags shortage when net variance is negative
    Given a closed session with cash short by 20
    When I navigate to the session report
    Then the reconciliation narrative net status is not "OK"

  Scenario: Narrative diagnosis explains cash surplus with inventory shortage
    Given a closed session with extra cash 50 and Espresso short by 2 units
    When I navigate to the session report
    Then the reconciliation narrative diagnosis mentions "unrecorded"
