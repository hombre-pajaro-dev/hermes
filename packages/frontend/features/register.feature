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
