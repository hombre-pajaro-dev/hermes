Feature: Admin — Settings
  As an admin, I want to manage register operations and application settings.

  Scenario: Admin submenu shows Register section by default
    Given I am on the Admin page
    Then I see the register status card

  Scenario: Admin can navigate to Discounts section
    Given I am on the Admin page
    When I navigate to the discounts admin section
    Then I see the discounts section
