Feature: Products
  Products have name, description, cost, price, and units.

  Scenario: List products
    Given I am on the Products page
    Then I see a list of products
    And each product shows name and price

  Scenario: Create a new product
    Given I am on the Products page
    When I click Add Product
    And I fill in product name as "Americano"
    And I fill in product description as "Black coffee"
    And I fill in product cost as 0.70
    And I fill in product price as 3.50
    And I fill in product units as 60
    And I click Create Product
    Then I see the product "Americano" in the list

  Scenario: Modify the price of a product
    Given I am on the Products page
    When I click the Edit price button for "Espresso"
    And I set the new price to 4.50
    And I save the new price
    Then the product "Espresso" shows price 4.50
    And no ledger entry is added for the price change

  Scenario: Cannot set price to zero or below
    Given I am on the Products page
    When I click the Edit price button for "Espresso"
    And I set the new price to 0
    And I save the new price
    Then I see an error message

  Scenario: Price edit is locked when product is in an open tab
    Given the register is open via the API with 200
    And "Espresso" is in an open tab via the API
    And I am on the Products page
    Then the price edit for "Espresso" is locked

  Scenario: Modify the cost of a product
    Given I am on the Products page
    When I click the Edit cost button for "Espresso"
    And I set the new cost to 1.20
    And I save the new cost
    Then the product "Espresso" shows cost 1.20
    And no ledger entry is added for the cost change

  Scenario: Cannot set cost to zero or below
    Given I am on the Products page
    When I click the Edit cost button for "Espresso"
    And I set the new cost to 0
    And I save the new cost
    Then I see an error message

  Scenario: Cost edit is locked when product is in an open tab
    Given the register is open via the API with 200
    And "Espresso" is in an open tab via the API
    And I am on the Products page
    Then the cost edit for "Espresso" is locked

  Scenario: Switch between list and grid view
    Given I am on the Products page
    Then I see a list of products
    When I switch to grid view
    Then I see products in a grid layout
    And each product card shows name and price
    When I switch to list view
    Then I see the list view

  Scenario: Products show image thumbnail or placeholder
    Given I am on the Products page
    Then each product shows a thumbnail or placeholder

  Scenario: Product with image shows the image
    Given a product "Espresso" has an image via the API
    And I am on the Products page
    Then the product "Espresso" shows its image
