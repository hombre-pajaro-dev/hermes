Feature: Inventory adjustment
  As an admin employee, I want to set physical count per product to match
  actual inventory so that discrepancies are recorded and losses appear on
  the ledger.

  Background:
    Given the register is open with opening cash 200

  Scenario: Adjust inventory to match physical count (loss)
    When I submit an inventory adjustment
      | product_name | physical_count |
      | Espresso     | 95             |
    Then the product "Espresso" units are now 95
    And the ledger has an "adjustment" entry with negative delta

  Scenario: Adjust inventory (increase – no loss)
    When I submit an inventory adjustment
      | product_name | physical_count |
      | Croissant    | 55             |
    Then the product "Croissant" units are now 55
    And the adjustment delta is positive

  Scenario: Adjustment is posted to the inventory_adjustment account
    When I submit an inventory adjustment
      | product_name | physical_count |
      | Espresso     | 95             |
    And I fetch the ledger
    Then there is a "adjustment" ledger entry with account "inventory_adjustment"

  Scenario: Shortage adjustment posts negative amount at cost price
    When I submit an inventory adjustment
      | product_name | physical_count |
      | Espresso     | 95             |
    Then the adjustment ledger entry amount reflects cost price loss

  Scenario: Surplus adjustment posts positive amount at cost price
    When I submit an inventory adjustment
      | product_name | physical_count |
      | Croissant    | 55             |
    Then the adjustment ledger entry amount reflects cost price gain

  Scenario: Cannot adjust when register is closed
    Given the register is closed
    When I try to submit an inventory adjustment
      | product_name | physical_count |
      | Espresso     | 90             |
    Then the response status is 403
    And the response error mentions "Register is not open"
