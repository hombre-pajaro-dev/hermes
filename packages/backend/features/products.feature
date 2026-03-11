Feature: Products
  Products have name, description, cost, price, and units (inventory).
  All products are sold by units with a sale price and a cost.

  Scenario: List products
    When I fetch all products
    Then the response is a non-empty array
    And each product has fields id, name, description, cost, price, units

  Scenario: Get a single product
    When I fetch the product named "Espresso"
    Then the product name is "Espresso"
    And the product cost is 0.80
    And the product price is 3.00
    And the product has a units field

  Scenario: Create a new product
    When I create a product with name "Americano" description "Black coffee" cost 0.70 price 3.50 units 60
    Then the response status is 201
    And the product name is "Americano"
    And the product cost is 0.70
    And the product price is 3.50
    And the product units is 60

  Scenario: Modify the price of a product
    When I update the price of "Espresso" to 4.50
    Then the response status is 200
    And the product price is 4.50
    And no ledger entry is created for the price change

  Scenario: Cannot set price to zero or below
    When I update the price of "Espresso" to 0
    Then the response status is 400
    And the response error mentions "greater than 0"

  Scenario: Cannot modify price when product is in an open tab
    Given the register is open with opening cash 200
    And a product "Espresso" is added to an open tab
    When I update the price of "Espresso" to 5.00
    Then the response status is 409
    And the response error mentions "open tabs"

  Scenario: Modify the cost of a product
    When I update the cost of "Espresso" to 1.20
    Then the response status is 200
    And the product cost is 1.20
    And no ledger entry is created for the cost change

  Scenario: Cannot set cost to zero or below
    When I update the cost of "Espresso" to 0
    Then the response status is 400
    And the response error mentions "greater than 0"

  Scenario: Cannot modify cost when product is in an open tab
    Given the register is open with opening cash 200
    And a product "Espresso" is added to an open tab
    When I update the cost of "Espresso" to 1.50
    Then the response status is 409
    And the response error mentions "open tabs"
