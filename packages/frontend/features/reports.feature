Feature: Reports
  As an admin employee, I want to see reports on sales.

  Background:
    Given the register is open via the API with 200

  Scenario: View sales by item report
    Given I am on the Reports page
    Then I see the sales by item section

  Scenario: View daily total report
    Given I am on the Reports page
    When I switch to the Daily tab
    Then I see the daily total section

  Scenario: View daily range report
    Given I am on the Reports page
    When I switch to the Range tab
    And I click Fetch
    Then I see the range report section

  Scenario: View close brief
    Given I am on the Reports page
    When I switch to the Brief tab
    Then I see the close brief section
