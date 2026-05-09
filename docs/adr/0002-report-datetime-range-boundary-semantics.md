# Report datetime range — boundary semantics for multi-day ranges

The Range report shows a day-by-day breakdown. When a datetime range spans multiple days, the time component of the `from` bound applies only to the **first** day and the time component of the `to` bound applies only to the **last** day. Days in between are shown in full (00:00–23:59).

We considered applying the same time window to every day in the range (e.g. "show only 08:00–14:00 sales for each day"), which would be useful for recurring shift analysis. We rejected it because it is a fundamentally different feature — shift reporting — that deserves its own dedicated design. The continuous-window interpretation is what "start datetime → end datetime" naturally implies and requires no extra UI to explain.
