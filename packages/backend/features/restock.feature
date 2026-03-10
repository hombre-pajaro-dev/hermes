Feature: Restock inventory
  As an employee, I want to insert a restock order to increase product units
  so that inventory reflects new stock.

  Background:
    Given the register is open with opening cash 200

  Scenario: Restock selected items with quantities
    When I submit a restock order with items
      | product_name | quantity |
      | Espresso     | 50       |
      | Croissant    | 30       |
    Then the product "Espresso" units increased by 50
    And the product "Croissant" units increased by 30
    And the ledger has a "restock" entry

  Scenario: Restock only some products
    When I submit a restock order with items
      | product_name | quantity |
      | Espresso     | 25       |
    Then the product "Espresso" units increased by 25
    And the product "Latte" units remain at 80

  Scenario: Cannot restock when register is closed
    Given the register is closed
    When I try to submit a restock order with items
      | product_name | quantity |
      | Espresso     | 10       |
    Then the response status is 403
    And the response error mentions "Register is not open"
