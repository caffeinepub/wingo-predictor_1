import Time "mo:core/Time";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Map "mo:core/Map";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import Text "mo:core/Text";

actor {
  type PeriodResult = {
    periodId : Text;
    number : Nat;
    timestamp : Time.Time;
  };

  type Prediction = {
    suggestion : Text;
    confidence : Nat;
  };

  module PeriodResult {
    type PeriodResult = {
      periodId : Text;
      number : Nat;
      timestamp : Time.Time;
    };

    public func compare(result1 : PeriodResult, result2 : PeriodResult) : Order.Order {
      Int.compare(result2.timestamp, result1.timestamp);
    };
  };

  let periodResults = Map.empty<Text, PeriodResult>();

  // Seed historical data if empty
  func seedHistoricalData() {
    if (periodResults.isEmpty()) {
      let seedData = [
        { periodId = "2023110100"; number = 5; timestamp = Time.now() },
        { periodId = "2023110101"; number = 8; timestamp = Time.now() },
        { periodId = "2023110102"; number = 2; timestamp = Time.now() },
      ];
      for (data in seedData.values()) {
        periodResults.add(data.periodId, data);
      };
    };
  };

  // Submit result for a period
  public shared ({ caller }) func submitPeriodResult(periodId : Text, number : Nat) : async () {
    seedHistoricalData();

    if (number > 9) { return };
    let result : PeriodResult = {
      periodId;
      number;
      timestamp = Time.now();
    };
    periodResults.add(periodId, result);
  };

  // Get recent N period results
  public query ({ caller }) func getRecentResults(n : Nat) : async [PeriodResult] {
    seedHistoricalData();

    var iter = periodResults.values();
    let sortedResults = iter.toArray().sort();

    let resultsSize = Nat.min(n, sortedResults.size());
    Array.tabulate<PeriodResult>(resultsSize, func(i) { sortedResults[i] });
  };

  // Get prediction for next period (simple version)
  public query ({ caller }) func getNextPrediction() : async Prediction {
    seedHistoricalData();

    // No advanced analysis for now
    {
      suggestion = "BIG";
      confidence = 50; // 50% confidence placeholder
    };
  };
};
