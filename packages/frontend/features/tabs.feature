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

  Scenario: Pay a tab with card shows receipt
    Given there is an open tab via the API named "Table 3"
    And I am on the Tabs page
    When I view the tab "Table 3"
    And I pay the tab with card
    Then I see the receipt modal

  Scenario: Pay a tab with cash shows live change and receipt
    Given there is an open tab via the API named "Cash Tab"
    And I am on the Tabs page
    When I view the tab "Cash Tab"
    And I proceed to cash payment
    And I enter cash received as 20
    Then I see the live change amount
    When I confirm payment
    Then I see the receipt modal
    And I see change due displayed

  Scenario: Tab receipt shows order items
    Given there is an open tab via the API named "Receipt Tab"
    And I am on the Tabs page
    When I view the tab "Receipt Tab"
    And I pay the tab with card
    Then I see the receipt modal
    And the receipt shows order items

  Scenario: Close tab receipt returns to tabs list
    Given there is an open tab via the API named "Close Tab"
    And I am on the Tabs page
    When I view the tab "Close Tab"
    And I pay the tab with card
    And I close the receipt modal
    Then I see the tabs list

  Scenario: Close an empty tab requires PIN
    Given I am on the Tabs page
    When I open a new tab named "Empty Tab"
    Then I see the close tab button
    When I close the empty tab with PIN "1234"
    Then I see the tabs list

  Scenario: Stock count is visible in the Add Items section
    Given there is an open tab via the API named "Stock View Tab"
    And I am on the Tabs page
    When I view the tab "Stock View Tab"
    Then the stock count for "Espresso" is visible in Add Items

  Scenario: Increase item quantity from the On the Tab section
    Given there is an open tab via the API named "Table 5"
    And I am on the Tabs page
    When I view the tab "Table 5"
    And I increase the quantity of "Espresso" on the tab
    Then the tab total is greater than 0

  Scenario: Remove an item by decreasing quantity to zero
    Given there is an open tab via the API named "Table 6"
    And I am on the Tabs page
    When I view the tab "Table 6"
    And I decrease the quantity of "Espresso" on the tab to zero
    Then the tab items section is empty
