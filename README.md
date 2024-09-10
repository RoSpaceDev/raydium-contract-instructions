# Overview

Rust API to Raydium on chain contracts

# Raydium do not publish any rust crate registry

# Do not use the crate, its fake and dangerous!!!

---

I COMMENTED THIS FROM example/Anchor

[test]
startup_wait = 5000
shutdown_wait = 2000
upgradeable = false

[test.validator]
bind_address = "0.0.0.0"
url = "https://api.devnet.solana.com"
ledger = ".anchor/test-ledger"
rpc_port = 8899

# [[test.validator.clone]]

# address = "EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"

# [[test.validator.clone]]

# address = "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"

# [[test.validator.clone]]

# address = "3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"

# [[test.validator.clone]]

# address = "8QN9yfKqWDoKjvZmqFsgCzAqwZBQuzVVnC388dN5RCPo"

[[test.validator.clone]]
address = "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"

[[test.validator.clone]]
address = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"

[[test.validator.clone]]
address = "7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5"

[[test.validator.clone]]
address = "8QN9yfKqWDoKjvZmqFsgCzAqwZBQuzVVnC388dN5RCPo"
