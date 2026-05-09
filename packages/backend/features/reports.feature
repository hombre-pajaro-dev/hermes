Feature: Reports
  As an admin employee, I want to see reports on sales and daily totals
  so that I can understand what was sold and revenue.

  Background:
    Given the register is open with opening cash 200
    And I have sold items
      | product_name | quantity | payment |
      | Espresso     | 2        | cash    |
      | Latte        | 1        | card    |

  Scenario: Sales by item report shows units and revenue
    When I fetch the sales by item report for today
    Then the report includes "Espresso" with units_sold 2
    And the report includes "Latte" with units_sold 1

  Scenario: Daily total report shows order count and totals
    When I fetch the daily total report for today
    Then the daily total has order_count at least 1
    And the daily total has positive total_sales
    And the daily total has positive total_cost

  Scenario: Daily total report breaks down sales by payment method
    When I fetch the daily total report for today
    Then the daily total has cash_sales greater than 0
    And the daily total has card_sales greater than 0

  Scenario: Close brief includes revenue, cost, most sold and most profitable
    When I fetch the close brief
    Then the close brief has revenue
    And the close brief has total_cost
    And the close brief has most_sold
    And the close brief has most_profitable
    And the close brief has by_item array

  Scenario: Daily range report for chart
    When I fetch the daily range from today to today
    Then the response has at least one day entry
    And each day has date, revenue, cost, order_count fields

  Scenario: Daily range respects time bounds on first and last day
    When I fetch the daily range from today "T00:00" to today "T00:01"
    Then the response has at least one day entry
    And the first day entry has zero revenue

  Scenario: Filter reports by date
    When I fetch the sales by item report for "2020-01-01"
    Then the response is an array

  Scenario: Sales by item report respects time component of datetime range
    When I fetch the sales by item report from today "T00:00" to today "T00:01"
    Then the response is an empty array

  Scenario: Sales by item report respects explicit timezone parameter
    When I fetch the sales by item report for today with tz "America/Monterrey"
    Then the response is an array

  Scenario: Inventory adjustment report shows per-product breakdown
    When I submit an inventory adjustment via reports context
      | product_name | physical_count |
      | Espresso     | 95             |
    And I fetch the inventory adjustment report for today
    Then the inventory adjustment report includes "Espresso"
    And the "Espresso" adjustment has a non-zero cost impact

  Scenario: Daily total includes inventory_adjustment_total field
    When I fetch the daily total for range today to today
    Then the daily total response has inventory_adjustment_total field

  Scenario: Daily total accepts from/to date range and includes tab payments
    When I open a new tab named "Range Test Tab"
    And I add items to the tab
      | product_name | quantity |
      | Latte        | 1        |
    And I pay the tab with card
    And I fetch the daily total for range today to today
    Then the daily total has order_count at least 2
    And the daily total has positive total_sales
