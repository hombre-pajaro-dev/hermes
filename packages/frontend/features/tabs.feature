Feature: Tabs (Long-lasting orders)
  As an employee, I want to open tabs for customers and add items.

  Background:
    Given the register is open via the API with 200

  Scenario: Open a new tab and add items
    Given I am on the Tabs page
    When I open a new tab named "Table 4"
    And I add "Espresso" to the tab
    Then the tab total is greater than 0

  Scenario: View open tabs summary
    Given there is an open tab via the API named "Bar 1"
    And I am on the Tabs page
    Then the open tab count is at least 1

  Scenario: Pay a tab with card
    Given there is an open tab via the API named "Table 3"
    And I am on the Tabs page
    When I view the tab "Table 3"
    And I pay the tab with card
    Then the tab is marked as paid
