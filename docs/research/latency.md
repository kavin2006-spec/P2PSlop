# Latency between the five players

Players: Netherlands (host candidate), 2x India, Hong Kong, Alaska.

## Published data

### Azure backbone, median (P50) round-trip time  [read]
Source: https://learn.microsoft.com/en-us/azure/networking/azure-network-latency
Probes run every minute between Azure regions. Data covers the 30 days ending 2026-07-30; page updated 2026-08-20.
Directional: each direction is listed separately.

| Pair | A to B (ms) | B to A (ms) |
|---|---|---|
| West Europe / Central India | 140 | 139 |
| West Europe / East Asia | 201 | 203 |
| Central India / East Asia | 87 | 88 |
| West US 2 / West Europe | 143 | 142 |
| West US 2 / Central India | 211 | 210 |
| West US 2 / East Asia | 141 | 141 |

The page lists region names only. Mapping West Europe = Netherlands, East Asia = Hong Kong, Central India = Pune
is from general knowledge **[unverified]**: confirm against Microsoft's region list before publishing.
These are datacenter-to-datacenter numbers on a private backbone, so they are a floor, not what homes get.

### Home ISPs vs backbone, RIPE Atlas  [read]
Source: https://www.gigenet.com/network-latency/
Probes hosted on local ISPs (up to 15 per city, 3 pings each; figure = median of each probe's average).
Hong Kong to Los Angeles 157 ms (2026-10-01). Seattle to Los Angeles 28 ms (2026-09-30).
Caveat: probes ping a site, not another home, so this says little about two residential ends.
I did not check the Azure East Asia / West US 148 ms figure it was compared against.

### Alaska to Seattle, Starlink study  [read]
Source: https://arxiv.org/pdf/2310.15808
One Alaska probe: median RTT 80 ms (75th percentile 120 ms) to its Starlink point of presence, which is in Seattle,
about 2,697 km away. Lowest US state medians are around 45 ms. One probe and one ISP type: a ceiling-style data
point, not typical fibre.

### Physics floor  [estimate]
2,697 km at roughly 200 km/ms in fibre, there and back = about 27 ms. So Alaska to Seattle is between ~27 and ~80 ms.

### Not re-checked  [unverified]
TechCrunch (Alaska traffic exits via subsea cables to Seattle), BroadbandNow city medians, an Alaskan ISP's "35-40 ms"
claim, an Overwatch forum post (70-80 ms), and an undated Amsterdam VPS benchmark on aluy.net (256 ms to Mumbai,
288 ms to Hong Kong). Colour only, not data. Speed-test pages do not say where the test servers are.

## Estimated pairwise RTT  [estimate unless marked]

| Pair | RTT (ms) | Basis |
|---|---|---|
| NL / India | 140 | Azure, read |
| NL / Hong Kong | 201-203 | Azure, read |
| India / Hong Kong | 87-88 | Azure, read |
| NL / Alaska | ~180 (170-220) | Azure West US 2 143 + Alaska leg 27-80 |
| Hong Kong / Alaska | ~180 (170-220) | Azure West US 2 141 + Alaska leg |
| India / Alaska | ~250 (240-290) | Azure West US 2 211 + Alaska leg |
| India / India | ~30 | pure assumption, depends on cities |

Assumes Alaska traffic routes via Seattle. Which ISP the Alaska player uses (fibre, microwave, satellite) matters a lot.

## Who should host (client-server, star topology)  [estimate]
Guest RTT to the host, in ms:

| Host | Guests | Worst | Average |
|---|---|---|---|
| Netherlands | IN 140, IN 140, HK 201, AK ~180 | 201 | ~165 |
| Hong Kong | NL 201, IN 87, IN 87, AK ~180 | 201 | ~139 |
| India | NL 140, IN ~30, HK 87, AK ~250 | ~250 | ~127 |
| Alaska | NL ~180, IN ~250, IN ~250, HK ~180 | ~250 | ~215 |

The host player plays at zero lag, which is an advantage. Compare with lockstep, where everyone gets the worst pair
(India / Alaska, about 250 ms).

## Used in the project
Lab presets in `site/js/chaos/injector.js` use half of these RTTs as one-way delay. Jitter and loss in the presets
are assumptions. Replace them with measured values from `docs/test-logs/`.

## Article angle
Published backbone figures vs what real home connections between friends get. Nobody has published residential-to-residential
numbers for these routes; the Network Lab can measure them.
