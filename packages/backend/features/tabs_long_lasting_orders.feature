Feature: Tabs (Long-lasting orders)
  As an employee, I want to open tabs for customers and add items
  so that the customer can pay at the end of the session.

  Background:
    Given the register is open with opening cash 200

  Scenario: Open a new tab and add items
    When I open a new tab named "Table 4"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 2        |
      | Latte        | 1        |
    Then the tab total is 11.00
    And the tab item count is 3

  Scenario: View open tabs summary
    When I open a new tab named "Bar 1"
    And I add items to the tab
      | product_name | quantity |
      | Croissant    | 2        |
    And I request the tabs summary
    Then the summary open count is at least 1
    And the summary total amount is at least 9.00

  Scenario: Pay a tab with cash
    When I open a new tab named "Table 7"
    And I add items to the tab
      | product_name | quantity |
      | Latte        | 2        |
    And I pay the tab with cash amount 15.00
    Then the tab status is "paid"
    And the ledger has a "tab_payment" entry

  Scenario: Pay a tab with card
    When I open a new tab named "Table 3"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 3        |
    And I pay the tab with card
    Then the tab status is "paid"
    And the tab payment method is "credit_card"

  Scenario: Update item quantity on a tab
    When I open a new tab named "Table 5"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 2        |
    And I update the tab item "Espresso" to quantity 3
    Then the tab total is 9.00
    And the tab item count is 3

  Scenario: Remove an item by setting quantity to zero
    When I open a new tab named "Table 6"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 1        |
      | Latte        | 1        |
    And I update the tab item "Espresso" to quantity 0
    Then the tab total is 5.00
    And the tab item count is 1

  Scenario: Adding a product to a tab decrements its stock
    When I open a new tab named "Stock Test 1"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 3        |
    Then the stock of "Espresso" decreased by 3

  Scenario: Removing units from a tab item restores the stock
    When I open a new tab named "Stock Test 2"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 3        |
    And I update the tab item "Espresso" to quantity 1
    Then the stock of "Espresso" decreased by 1

  Scenario: Cannot add more items to a tab than available stock
    When I open a new tab named "Stock Test 3"
    And I try to add items to the tab exceeding stock
      | product_name | quantity |
      | Espresso     | 9999     |
    Then the response status is 409
    And the response error mentions "Insufficient stock"

  Scenario: Void an empty tab
    When I open a new tab named "Empty Tab"
    And I void the tab
    Then the response status is 200
    And the tab status is "voided"

  Scenario: Cannot void a tab that has items
    When I open a new tab named "Non-Empty Tab"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 1        |
    And I void the tab
    Then the response status is 409
    And the response error mentions "has items"

  Scenario: Cannot close register while tabs are open
    When I open a new tab named "Table 9"
    And I add items to the tab
      | product_name | quantity |
      | Croissant    | 1        |
    And I try to close the register with closing cash 200
    Then the response status is 409
    And the response error mentions "open tabs"
