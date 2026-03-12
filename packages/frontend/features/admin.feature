Feature: Admin — PIN Security
  As an admin, I want to manage the security PIN and protect sensitive operations
  so that unauthorised staff cannot perform cash-outs, close the register, or open staff-cost tabs.

  Scenario: Change the PIN successfully
    Given I am on the Admin page
    When I fill in current PIN as "1234"
    And I fill in new PIN as "5678"
    And I fill in confirm PIN as "5678"
    And I click Change PIN
    Then I see a success message

  Scenario: Cannot change PIN with incorrect current PIN
    Given I am on the Admin page
    When I fill in current PIN as "0000"
    And I fill in new PIN as "5678"
    And I fill in confirm PIN as "5678"
    And I click Change PIN
    Then I see an error message

  Scenario: Cannot change PIN when new PINs do not match
    Given I am on the Admin page
    When I fill in current PIN as "1234"
    And I fill in new PIN as "5678"
    And I fill in confirm PIN as "9999"
    And I click Change PIN
    Then I see an error message

  Scenario: Wrong PIN on cash out is rejected
    Given the register is open via the API with 200
    And I am on the Register page
    When I fill in cashout amount as 50
    And I fill in cashout reason as "Safe drop"
    And I click Cash Out
    And I enter PIN "0000" in the modal
    Then I see a PIN error message

  Scenario: Wrong PIN on close register is rejected
    Given the register is open via the API with 200
    And I am on the Register page
    When I fill in closing cash as 175
    And I click Close Register
    And I enter PIN "0000" in the modal
    Then I see a PIN error message

  Scenario: Wrong PIN on at-cost tab is rejected
    Given the register is open via the API with 200
    And I am on the Tabs page
    When I open a new at-cost tab named "Staff Table"
    And I enter PIN "0000" in the modal
    Then I see a PIN error message
