# RedirectHub

A URL shortening and analytics service built to learn backend engineering.

## ID Generation Strategy

Three approaches considered for generating short codes:

1. **Auto-increment + Base62 encoding (chosen)**
   - How it works: PostgreSQL SERIAL generates a unique integer, 
     Base62-encode it into a short string
   - Pros: Guaranteed uniqueness (DB enforces it), no collision 
     checks needed, short codes stay short since Base62 is compact
   - Cons: Predictable/sequential — codes reveal creation order 
     and approximate volume. Not safe across multiple DB shards 
     since two shards could generate the same integer independently

2. **Random string generation**
   - How it works: Generate N random alphanumeric characters
   - Pros: Not predictable, works fine across distributed systems
   - Cons: Collision risk grows with volume — needs a uniqueness 
     check before insert, which means an extra query or retry loop

3. **Hash-based (MD5/SHA of the URL, truncated)**
   - How it works: Hash the original URL, take first N characters
   - Pros: Same URL always produces same short code (natural dedup)
   - Cons: Hash collisions are possible even after truncation, and 
     two different URLs can produce the same truncated hash

**Chosen: Auto-increment + Base62** because this is a single-instance 
system (not distributed across shards), so the "not safe across shards" 
downside doesn't apply yet. Simplicity and guaranteed uniqueness win here.
