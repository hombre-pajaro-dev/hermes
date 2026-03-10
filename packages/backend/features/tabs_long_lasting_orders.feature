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

  Scenario: Cannot close register while tabs are open
    When I open a new tab named "Table 9"
    And I add items to the tab
      | product_name | quantity |
      | Croissant    | 1        |
    And I try to close the register with closing cash 200
    Then the response status is 409
    And the response error mentions "open tabs"
