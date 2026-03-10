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
