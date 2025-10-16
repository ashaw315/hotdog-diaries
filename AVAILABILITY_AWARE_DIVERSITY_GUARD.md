# Availability-Aware Diversity Guard

## Overview

The Availability-Aware Diversity Guard is an enhancement to the scheduler validation system that prevents false diversity failures when the content pool itself lacks sufficient quality content across platforms.

## Problem Solved

Previously, the system would fail validation if only 2-3 platforms were used in a schedule, even when the remaining platforms had insufficient high-quality content to justify inclusion. This led to false negatives where a "2-platform schedule from a 7-platform pool" would be incorrectly flagged as a diversity failure.

## Implementation

### Quality Thresholds

The system now evaluates platform eligibility based on:

- **MIN_CANDIDATES**: Minimum number of content items required per platform (default: 20)
- **MIN_CONF**: Minimum confidence score for content quality (default: 0.70)
- **ingest_priority**: Must be >= 0 (content not deprioritized)

### Availability Analysis

```bash
# Query content_queue via Supabase REST
curl -sS "${SUPABASE_URL}/rest/v1/content_queue?select=source_platform,confidence_score,ingest_priority,is_posted,is_approved&is_approved=eq.true&ingest_priority=gte.0&or=(is_posted.is.null,is_posted.eq.false)" \
  "${SB_HDR[@]}" > pool_quality_raw.json

# Analyze platform eligibility
jq --argjson min_conf "$MIN_CONF" --argjson min_candidates "$MIN_CANDIDATES" '
  group_by(.source_platform) 
  | map({
      platform: (.[0].source_platform|ascii_downcase),
      eligible: (map(select((.confidence_score // 0) >= $min_conf)) | length),
      total: length
    })
  | map(. + {meets_cap: (.eligible >= $min_candidates)})
' pool_quality_raw.json > eligibility_snapshot.json
```

### Diversity Validation Logic

```bash
eligible_count=$(jq '[.[] | select(.meets_cap==true)] | length' eligibility_snapshot.json)

if (( eligible_count >= 4 )); then
  # Sufficient platforms available - enforce strict diversity
  pass_diversity=$([[ "${platforms_2d}" -ge 4 ]] && echo "OK" || echo "FAIL")
  diversity_note="Eligible platforms >=4; enforcing diversity>=4"
else
  # Limited platforms available - warn but don't fail
  pass_diversity="WARN" 
  diversity_note="Eligible platforms <4 (pool lacks depth); diversity not enforced"
fi
```

### Exit Conditions

- **PASS**: All criteria met (slots + diversity)
- **PASS WITH WARNING**: Slots OK, diversity warning due to limited platform pool quality
- **FAIL**: Slots or diversity requirements not met when platforms are available

## Example Scenarios

### Scenario 1: Limited Pool Quality
- Pool has 7 platforms total
- Only 2 platforms meet quality thresholds (MIN_CONF=0.70, MIN_CANDIDATES=20)
- Schedule uses 2-3 platforms
- **Result**: WARN (documents "limited availability")

### Scenario 2: Sufficient Pool Quality  
- Pool has 7 platforms total
- 6 platforms meet quality thresholds
- Schedule uses only 2 platforms
- **Result**: FAIL (diversity not met when platforms are available)

## Artifacts Generated

1. **eligibility_snapshot.json**: Platform-by-platform quality analysis
2. **eligibility_summary.tsv**: Human-readable platform summary  
3. **pool_quality_raw.json**: Raw content quality data
4. **rebalance_verification.md**: Complete validation report

## Configuration

Environment variables for tuning:

```bash
MIN_CANDIDATES=20    # Minimum content items per platform
MIN_CONF=0.70       # Minimum confidence score (0.0-1.0)
```

## Integration

The guard is integrated into `devops_validation.sh` as Step 2.5, running after pool distribution analysis but before refill operations. It informs the final pass/fail logic without breaking existing workflows.

## Benefits

1. **Reduces False Positives**: Avoids failing validation when pool quality is genuinely limited
2. **Maintains Standards**: Still enforces diversity when platforms are available  
3. **Provides Visibility**: Documents availability constraints in validation reports
4. **Configurable**: Thresholds can be adjusted based on operational needs
5. **Non-Breaking**: Existing validation logic remains intact with additional intelligence