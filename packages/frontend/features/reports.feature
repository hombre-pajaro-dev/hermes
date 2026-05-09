Feature: Reports
  As an admin employee, I want to see reports on sales.

  Background:
    Given the register is open via the API with 200

  Scenario: View sales by item report
    Given I am on the Reports page
    Then I see the sales by item section

  Scenario: By Item report shows daily summary alongside items
    Given I am on the Reports page
    Then I see the daily total section

  Scenario: Daily summary shows cash and card breakdown
    Given I am on the Reports page
    Then I see the cash sales stat
    And I see the card sales stat

  Scenario: View daily range report
    Given I am on the Reports page
    When I switch to the Range tab
    And I click Apply on the date range filter
    Then I see the range report section

  Scenario: By Item tab has an Apply button with datetime inputs
    Given I am on the Reports page
    Then I see the date range apply button
    And I see datetime inputs on the By Item tab

  Scenario: View close brief
    Given I am on the Reports page
    When I switch to the Brief tab
    Then I see the close brief section

  Scenario: Sessions tab shows session selector
    Given I am on the Reports page
    When I switch to the Sessions tab
    Then I see the session selector

  Scenario: Sessions tab shows tab exclusion notice
    Given I am on the Reports page
    When I switch to the Sessions tab
    Then I see the session tab notice
