# Racks to Riches

## Game Design and Development Framework

### Working tagline

Build the rack. Host the workload. Make the numbers go vroom.

---

# 1. Game overview

## Genre

Browser-based idle and incremental infrastructure management game.

## Core fantasy

The player starts as a bedroom hosting provider using old consumer hardware and gradually grows into a global cloud infrastructure company.

Progression is represented physically through:

- Larger facilities
- More server racks
- Denser hardware
- Specialized rack configurations
- Larger customers
- More valuable contracts
- Automated infrastructure management
- Increasingly absurd revenue numbers

## Elevator pitch

Racks to Riches is an idle infrastructure management game where players build server racks, install specialized hardware, accept hosting contracts, manage power and cooling, replace obsolete equipment, and scale from a bedroom server into a global data-center empire.

---

# 2. Design pillars

## Physical progression

Growth must be visibly represented through racks, hardware, facilities, blinking equipment, and denser infrastructure.

The player should not merely purchase abstract percentage upgrades.

## Meaningful optimization

Racks have limited space, power, cooling, and network capacity. Players must decide what equipment belongs together and when old hardware should be replaced.

## Satisfying idle income

Contracts generate continuous revenue. The player can leave the game and return to meaningful offline earnings.

## Constant redesign

A rack configuration should never remain optimal forever. New workloads, better hardware, growing customers, and new facility capabilities should encourage rebuilding.

## Manageable complexity

The systems should feel technical without requiring actual systems-administration knowledge.

The player should understand why something is failing through clear UI feedback.

## Recoverable failure

Bad infrastructure decisions reduce revenue and reputation, but should not destroy hours of progress.

---

# 3. Core gameplay loop

1. Review available hosting contracts.
2. Purchase a rack or use an existing rack.
3. Install servers, storage, networking, cooling, and power equipment.
4. Assign contracts to the rack.
5. Earn recurring revenue while contract requirements are fulfilled.
6. Upgrade or replace inefficient hardware.
7. Earn reputation and research progress.
8. Unlock better contracts, hardware, racks, and facilities.
9. Build specialized rack groups.
10. Automate mature parts of the company.
11. Eventually perform an IPO or company sale for prestige progression.

The main loop can be summarized as:

Acquire demand → build capacity → earn money → improve efficiency → unlock larger demand

---

# 4. Player resources

## Cash

Used to purchase:

- Racks
- Hardware
- Facilities
- Facility upgrades
- Contract-market rerolls
- Repairs and maintenance

Cash is generated primarily through contracts.

## Revenue per second

The player's current gross contract income before operating expenses.

## Net income per second

Revenue after:

- Electricity costs
- Facility rent
- Contract penalties
- Temporary incident effects

This is the primary number-go-vroom statistic.

## Reputation

Represents customer trust and company scale.

Reputation unlocks:

- Higher contract tiers
- Better customers
- New service categories
- Larger facilities
- Enterprise opportunities

Reputation is gained through successful contract terms and strong service performance.

Reputation is lost through severe SLA violations, canceled contracts, and failed milestone contracts.

## Research points

Used to unlock technology.

Research comes from:

- Completing first-time contract categories
- Reaching company milestones
- Operating advanced hardware
- Completing experimental contracts
- Achievements

## Prestige currency

Post-MVP currency tentatively called Industry Influence.

Earned by:

- Selling the company
- Completing an IPO
- Reaching lifetime revenue milestones
- Serving major customers
- Completing prestigious infrastructure projects

Industry Influence provides permanent bonuses and alternate starting options.

---

# 5. Infrastructure statistics

The simulation uses six primary infrastructure statistics.

## Compute

General CPU processing capability.

Used by:

- Website hosting
- Game servers
- Databases
- SaaS applications
- Virtual machines

## GPU compute

Accelerated processing capacity.

Used by:

- Video rendering
- AI inference
- AI training
- Scientific simulation

## Storage

Usable hosted data capacity.

Used by:

- Websites
- Backups
- Databases
- Media storage
- Enterprise platforms

Storage performance can become a later secondary statistic. The MVP should only use total storage.

## Bandwidth

Maximum external data throughput.

Used by nearly every contract.

## Power

Every device consumes power.

Each rack and facility has a maximum supported power draw.

Exceeding available power reduces rack performance and increases outage risk.

## Cooling

Devices produce heat.

Cooling devices and facility infrastructure provide cooling capacity.

Insufficient cooling causes thermal throttling and lowers effective equipment performance.

## Reliability

A derived percentage based on:

- Hardware reliability
- UPS coverage
- Cooling health
- Power headroom
- Rack overload
- Facility quality
- Redundancy upgrades

Reliability determines approximate service uptime.

---

# 6. Simulation model

## Simulation tick

The game simulation advances once per second.

Animations may update more frequently, but economic and infrastructure calculations should use one-second ticks.

The game engine must expose a pure function:

```ts
advanceGame(state, deltaSeconds);
```

This same function supports:

- Normal online play
- Offline earnings
- Automated tests
- Future game-speed options

## Rack capacity

Each rack calculates total capacity from installed equipment.

```text
Total compute = Sum of installed compute
Total GPU = Sum of installed GPU capacity
Total storage = Sum of installed storage
Total bandwidth = Sum of network capacity
Total power draw = Sum of device power draw
Total heat = Sum of device heat output
```

## Power efficiency

```text
Power ratio = Available power / Required power
```

When the ratio is at least 1.0, no penalty applies.

When below 1.0, equipment output is multiplied by the power ratio.

## Cooling efficiency

```text
Cooling ratio = Available cooling / Produced heat
```

When the ratio is at least 1.0, no penalty applies.

When below 1.0, equipment output is reduced.

The MVP can use:

```text
Thermal efficiency = clamp(Cooling ratio, 0.25, 1.0)
```

## Effective capacity

```text
Effective capacity =
Raw capacity
× Power efficiency
× Thermal efficiency
× Hardware bonuses
× Rack specialization bonuses
× Research bonuses
```

---

# 7. Facilities

Facilities determine:

- Maximum rack count
- Total available power
- Base cooling capacity
- Internet capacity
- Rent
- Reliability bonus
- Supported rack types

## Facility 1: Bedroom

Starting facility.

Properties:

- One rack slot
- Residential power
- Consumer internet
- No rent
- Weak cooling
- Low reliability
- Supports 12U starter racks

Visual style:

- Folding table
- Tangled cables
- Consumer router
- Desk or box fan
- Old desktop hardware

## Facility 2: Office server closet

Unlocked at Local Provider reputation.

Properties:

- Four rack slots
- Dedicated circuits
- Business internet
- Basic air conditioning
- Monthly or per-second rent
- Supports standard racks

## Facility 3: Colocation suite

Unlocked at Regional Provider reputation.

Properties:

- Twelve rack slots
- Redundant power
- Fiber networking
- Better cooling
- Higher rent
- Supports specialized racks
- Unlocks rack groups

## Facility 4: Private data center

Unlocked at Enterprise Provider reputation.

Properties:

- Multiple rooms
- Large rack capacity
- Backup generators
- High-capacity cooling
- Multiple network uplinks
- Redundancy bonuses
- Supports advanced equipment

## Facility 5: Hyperscale campus

Post-MVP late-game facility.

Properties:

- Rack halls
- Automated deployment
- Custom power generation
- Global service pools
- Massive enterprise contracts

---

# 8. Rack system

## Rack properties

Every rack definition includes:

- Rack unit capacity
- Maximum power load
- Airflow modifier
- Reliability modifier
- Purchase cost
- Supported equipment tags
- Specialization bonuses
- Facility requirements

## Starter 12U rack

- Cheap
- Low power limit
- Poor airflow
- General-purpose
- Used during bedroom hosting

## Standard 24U rack

- Balanced
- Moderate capacity
- Suitable for small business workloads

## Standard 42U rack

- Main general-purpose rack
- High capacity
- Supports most hardware

## Compute rack

- Bonus to CPU servers
- Increased power capacity
- Reduced storage efficiency

## Storage rack

- Bonus to storage arrays
- Improved drive density
- Reduced GPU efficiency

## GPU rack

- Supports accelerator chassis
- Improved cooling
- Very high power requirements

## Network rack

- Holds network and security equipment
- Improves nearby rack bandwidth and reliability
- Produces little direct capacity

## Liquid-cooled rack

Late-game rack.

- Excellent cooling
- High equipment density
- Supports overclocked hardware
- Requires facility plumbing research

---

# 9. Equipment system

Equipment occupies rack units and modifies rack statistics.

Every equipment item should be data-driven.

## Equipment definition fields

```ts
interface EquipmentDefinition {
  id: string;
  name: string;
  category:
    | "compute"
    | "gpu"
    | "storage"
    | "network"
    | "power"
    | "cooling"
    | "security";
  generation: number;
  rackUnits: number;
  purchaseCost: number;
  resaleRatio: number;
  powerDraw: number;
  heatOutput: number;
  compute?: number;
  gpuCompute?: number;
  storage?: number;
  bandwidth?: number;
  cooling?: number;
  powerCapacity?: number;
  reliability?: number;
  requiredResearch?: string;
  requiredReputationTier?: string;
  tags: string[];
}
```

## Equipment categories

### Compute servers

Provide general compute.

Examples:

- Refurbished desktop
- Tower server
- Used 2U server
- Modern 1U server
- Blade chassis
- High-density compute node

### GPU servers

Provide GPU compute.

Examples:

- Consumer GPU workstation
- Dual-GPU render server
- Enterprise accelerator server
- AI training node

### Storage

Provide hosted storage.

Examples:

- External drive enclosure
- Basic NAS
- 4U disk array
- Enterprise storage shelf
- NVMe storage appliance

### Networking

Provide bandwidth and bonuses.

Examples:

- Consumer router
- Gigabit switch
- Managed switch
- 10-gigabit switch
- Core router
- Load balancer

### Power

Provide rack power capacity and reliability.

Examples:

- Residential power strip
- Rack PDU
- Basic UPS
- Redundant UPS
- Intelligent power distribution

### Cooling

Provide cooling capacity.

Examples:

- Desk fan
- Box fan
- Rack fan panel
- Portable air conditioner
- In-row cooling
- Liquid cooling manifold

### Security

Required by advanced contracts.

Examples:

- Basic firewall
- Enterprise firewall
- Encryption appliance
- Intrusion detection system

---

# 10. Hardware progression philosophy

Hardware should generally not receive infinite direct upgrades.

Progression comes from buying newer generations and physically replacing older equipment.

Newer hardware provides:

- More capacity per rack unit
- Better efficiency per watt
- Improved reliability
- Better specialization bonuses
- Access to premium contracts

Older hardware remains useful for:

- Backup racks
- Low-priority customers
- Secondary facilities
- Cheap service pools
- Resale
- Scrapping

The player should regularly make decisions such as:

- Replace now or continue saving?
- Sell the old hardware?
- Move it into a backup rack?
- Use it for budget contracts?
- Keep it as emergency capacity?

---

# 11. Rack building

## Rack editor

The player selects a rack and sees a vertical unit grid.

Equipment can be:

- Purchased directly into a rack
- Dragged between rack positions
- Moved between racks
- Powered on or off
- Sold
- Scrapped
- Saved as part of a template

## Rack-unit rules

- Equipment occupies contiguous rack units.
- Equipment cannot overlap.
- Equipment must fit within the rack.
- Some racks may restrict equipment categories.
- Some large equipment may require specific rack types.

## Rack specialization

A rack may be assigned a purpose:

- General hosting
- Web hosting
- Database
- Game servers
- Storage
- GPU rendering
- AI processing
- Backup
- Network core

Matching equipment and workloads provide bonuses.

Example:

```text
Web Hosting Rack

+15% website contract revenue
+10% bandwidth efficiency
-10% GPU workload efficiency
```

Specialization should be optional.

Mixed racks remain useful during the early game.

---

# 12. Contract system

Contracts are the primary source of revenue.

Hardware does not directly produce money. Hardware creates capacity that fulfills contracts.

## Contract flow

1. A contract appears in the marketplace.
2. The player reviews its requirements.
3. The player accepts or rejects it.
4. The player assigns it to a rack.
5. The contract reserves infrastructure demand.
6. The contract pays recurring revenue.
7. The contract completes a term.
8. The customer renews, grows, or leaves.

## Contract fields

```ts
interface ContractInstance {
  id: string;
  customerId: string;
  serviceType: ServiceType;
  tier: number;
  status:
    "offered" | "active" | "expiring" | "completed" | "breached" | "cancelled";
  assignedTargetId?: string;
  requirements: {
    compute?: number;
    gpuCompute?: number;
    storage?: number;
    bandwidth?: number;
    reliability?: number;
    security?: number;
  };
  baseRevenuePerSecond: number;
  remainingSeconds: number;
  totalDurationSeconds: number;
  growthPotential: "none" | "low" | "medium" | "high";
  customerTolerance: number;
  performanceScore: number;
  violationSeconds: number;
  autoRenew: boolean;
}
```

## Early assignment model

During the first two reputation tiers, contracts are assigned directly to individual racks.

Each rack acts as its own service pool.

## Mid-game assignment model

Rack groups become available.

Several racks can be grouped into a cluster.

Contracts assigned to that cluster use the combined capacity of every rack in the group.

Examples:

- Web hosting cluster
- Database cluster
- GPU render cluster
- Backup cluster

## Late-game assignment model

Contracts are assigned to facility-level service pools rather than individual racks.

This prevents the player from manually managing hundreds of individual clients.

---

# 13. Contract fulfillment

For each rack or service pool:

```text
Compute ratio = Available compute / Required compute
GPU ratio = Available GPU / Required GPU
Storage ratio = Available storage / Required storage
Bandwidth ratio = Available bandwidth / Required bandwidth
Reliability ratio = Actual reliability / Required reliability
```

Only resources required by active contracts are included.

The pool performance score is the lowest relevant ratio.

```text
Performance score =
Minimum relevant resource ratio
```

The score may exceed 1.0 when overprovisioned.

## Revenue multiplier

Suggested MVP model:

```text
Below 50% fulfillment:
No revenue and SLA violation

50% to 100% fulfillment:
Revenue multiplier = fulfillment²

100% to 125% fulfillment:
Revenue multiplier = 1 + ((fulfillment - 1) × 0.8)

Above 125%:
Multiplier capped at 1.20
```

Examples:

- 80% fulfillment produces 64% revenue.
- 100% fulfillment produces full revenue.
- 110% fulfillment produces 108% revenue.
- 125% fulfillment produces 120% revenue.
- More than 125% provides no additional contract bonus.

This prevents tiny contracts from earning absurd bonuses on enormous hardware.

---

# 14. Contract service categories

## Website hosting

Requires:

- Compute
- Storage
- Bandwidth

Progression:

- Personal website
- Shared hosting
- Business website
- E-commerce
- SaaS application
- Enterprise platform
- Global edge hosting

## Cloud storage and backup

Requires:

- Storage
- Bandwidth
- Reliability

Progression:

- Personal file storage
- Small business backup
- Managed backup
- Disaster recovery
- Enterprise archive
- Global storage platform

## Game servers

Requires:

- Compute
- Bandwidth
- Reliability

Progression:

- Private server
- Community server
- Indie multiplayer launch
- Regional game hosting
- Major live-service game
- Global game infrastructure

## Database hosting

Requires:

- Compute
- Storage
- Reliability

Progression:

- Small business database
- E-commerce database
- SaaS production database
- Enterprise database
- Financial or healthcare system
- Global transactional platform

## Video rendering

Requires:

- GPU compute
- Storage
- Power availability

Progression:

- Small animation job
- Commercial rendering
- Film production
- Streaming transcoding
- Global media processing

## AI processing

Late-game service.

Requires:

- GPU compute
- Bandwidth
- Cooling
- High power availability

Progression:

- AI inference
- Model fine-tuning
- Model training
- Enterprise AI platform
- Scientific foundation model

---

# 15. Contract progression

Contract progression occurs across four systems.

## Company reputation tiers

### Tier 1: Bedroom Host

Reputation: 0 to 99

Contracts:

- Personal websites
- File storage
- Private game servers
- Development environments

Infrastructure:

- One rack
- Mixed equipment
- Weak uptime requirements

### Tier 2: Local Provider

Reputation: 100 to 499

Contracts:

- Local business websites
- Small e-commerce
- Managed backup
- Community game servers

New mechanics:

- Bandwidth requirements
- Basic security
- Customer growth
- 24U and 42U racks

### Tier 3: Regional Provider

Reputation: 500 to 1,999

Contracts:

- SaaS platforms
- Regional game hosting
- Databases
- Rendering
- Business continuity

New mechanics:

- Rack groups
- Redundancy
- Specialization
- Demand spikes
- Stronger SLAs

### Tier 4: Enterprise Cloud

Reputation: 2,000 to 7,999

Contracts:

- National businesses
- Healthcare
- Financial systems
- Streaming platforms
- AI processing

New mechanics:

- Multi-rack contracts
- Security requirements
- Failover infrastructure
- Dedicated service pools

### Tier 5: Global Platform

Reputation: 8,000+

Contracts:

- Global content delivery
- Government infrastructure
- Massive game launches
- Global AI platforms
- Scientific computing

New mechanics:

- Multi-facility contracts
- Regional service pools
- Automated deployment
- Prestige progression

---

# 16. Customers

The game uses two customer types.

## Procedural customers

Randomly generated customers provide most marketplace offers.

Generated values include:

- Company name
- Industry
- Service type
- Demand
- Budget
- Growth potential
- Tolerance
- Contract duration

## Anchor customers

Persistent named customers that can grow throughout the game.

Anchor customers begin small and offer expansion contracts after good service.

Example progression:

```text
Foxfire Studios I
Portfolio website

Foxfire Studios II
Website and file storage

Foxfire Studios III
Customer platform and database

Foxfire Studios IV
Global creative platform and rendering

Foxfire Studios V
Enterprise media infrastructure
```

The MVP should include three anchor customers with four stages each.

---

# 17. Customer growth

At contract renewal, a customer may:

- Renew unchanged
- Request additional capacity
- Add another service
- Offer a longer term
- Offer a higher-value SLA
- Refer another customer
- Leave

Growth chance depends on:

- Contract growth potential
- Average performance
- Customer loyalty
- Company reputation
- Research bonuses

The player may:

- Accept the expansion
- Keep the current contract
- Decline the expansion
- End the customer relationship

Declining one expansion should not immediately remove the customer.

---

# 18. Contract durations

## Early game

Three to ten minutes.

Purpose:

- Fast feedback
- Frequent upgrades
- Easy experimentation

## Mid game

Ten to thirty minutes.

Purpose:

- Infrastructure planning
- More meaningful commitments

## Late game

Thirty minutes to several hours.

Purpose:

- Stable idle income
- Larger strategic accounts
- Automation value

Players eventually unlock auto-renewal.

---

# 19. Contract marketplace

The marketplace begins with three offer slots.

Offers refresh automatically every sixty seconds.

The player may spend cash to reroll offers.

Marketplace upgrades unlock:

- Additional offer slots
- Faster refreshes
- Service filters
- Minimum revenue filters
- Growth-potential filters
- Contract scouting
- Sales automation
- Direct enterprise negotiations

The MVP should support:

- Three offer slots
- One-minute refresh
- Manual reroll
- Accept
- Reject
- Assignment to a compatible rack

---

# 20. Contract penalties

Contracts track cumulative violation time.

Small temporary violations reduce revenue but do not immediately fail the contract.

Suggested tolerance:

- Below 100% fulfillment starts adding violation time.
- Returning above 100% slowly reduces violation time.
- Reaching the contract's violation threshold causes a breach.

Breaching may cause:

- Lost reputation
- Contract cancellation
- Reduced customer loyalty
- Temporary reduction in marketplace quality

Offline progress should not generate catastrophic contract failures.

Offline simulation should use the infrastructure state present at logout and cap penalties.

---

# 21. Operating expenses

## Electricity

Power draw generates a recurring electricity expense.

Newer hardware should generally provide more capacity per unit of electricity.

## Facility rent

Every facility after the bedroom has recurring rent.

## Optional future expenses

Not required for MVP:

- Staff salaries
- Hardware maintenance
- Insurance
- Internet transit pricing
- Equipment leasing

The MVP economy should use only electricity and facility rent.

---

# 22. Equipment resale and replacement

Equipment can be sold for a percentage of purchase price.

Suggested resale model:

```text
Base resale value = Purchase price × Equipment resale ratio
```

Generation age may later reduce resale value.

The MVP can use a fixed resale ratio between 40% and 70%.

There should be no complex wear system during the MVP.

---

# 23. Research system

Research should have four branches.

## Hardware

Unlocks:

- New server generations
- GPU equipment
- Storage generations
- High-density hardware

## Infrastructure

Unlocks:

- Larger racks
- Better cooling
- UPS systems
- Rack groups
- Advanced facilities

## Services

Unlocks:

- Databases
- Rendering
- AI processing
- Enterprise hosting
- Regulated contracts

## Automation

Unlocks:

- Auto-renewal
- Contract filters
- Rack templates
- Automatic workload balancing
- Automated contract acceptance

Research nodes may require both research points and reputation tiers.

---

# 24. Automation progression

## Early game

Manual:

- Accept contracts
- Assign contracts
- Purchase hardware
- Renew contracts
- Replace equipment

## Mid game

Unlocked automation:

- Auto-renew
- Recommended rack assignment
- Rack templates
- Low-capacity warnings
- Contract marketplace filters

## Late game

Advanced automation:

- Auto-accept rules
- Automatic workload balancing
- Automatic failover
- Automatic rack deployment
- Equipment replacement policies
- Contract profitability rules

The player should automate solved problems and focus on new infrastructure tiers.

---

# 25. Events and incidents

Events are not required for the first playable build.

When added, events should usually create short-term decisions rather than permanent punishment.

## Positive events

- Viral traffic surge
- Major game launch
- Hardware discount
- Government grant
- Cheap electricity period
- Customer referral

## Negative events

- Heat wave
- ISP instability
- Cooling failure
- Power interruption
- Hardware shortage
- Failed server component

## Decision events

- Purchase used hardware at a discount
- Accept an unusually demanding customer
- Delay maintenance for temporary revenue
- Upgrade a loyal customer for reduced upfront payment
- Choose between efficiency and overclocking

Offline incidents should not destroy hardware or terminate important contracts.

---

# 26. Offline progression

When the game loads:

1. Determine elapsed real time.
2. Cap offline progress.
3. Simulate contract revenue and expenses.
4. Apply reduced customer growth calculations.
5. Do not generate destructive random incidents.
6. Present a clear earnings summary.

Suggested MVP offline cap:

Eight hours.

Offline efficiency:

100% initially.

A later research upgrade may increase the offline cap.

---

# 27. Prestige

Prestige is not required for the MVP but should be supported architecturally.

## Prestige action

The player sells the company or completes an IPO.

Resets:

- Cash
- Hardware
- Facilities
- Active contracts
- Most research

Retains:

- Industry Influence
- Achievements
- Lifetime statistics
- Anchor customer history
- Cosmetic unlocks

## Permanent prestige bonuses

Examples:

- Higher starting cash
- Improved contract quality
- Reduced equipment cost
- Increased offline cap
- Faster reputation gain
- Early access to used enterprise hardware
- Increased resale value

---

# 28. User interface

## Main navigation

- Dashboard
- Facility
- Contracts
- Hardware Store
- Research
- Company
- Settings

## Dashboard

Displays:

- Cash
- Gross revenue per second
- Net income per second
- Reputation
- Research points
- Active contracts
- Current capacity utilization
- Power usage
- Cooling usage
- Recent events

## Facility view

Displays:

- Current facility
- Available rack slots
- Installed racks
- Facility power and cooling
- Internet capacity
- Rack status indicators

## Rack view

Displays:

- Vertical rack-unit grid
- Installed equipment
- Used and available rack units
- Compute
- GPU compute
- Storage
- Bandwidth
- Power
- Heat
- Reliability
- Assigned contracts
- Revenue generated

## Contract marketplace

Displays:

- Available offers
- Requirements
- Revenue
- Duration
- SLA
- Growth potential
- Compatible racks
- Accept and reject controls

## Active contracts

Displays:

- Customer
- Assigned rack or pool
- Performance percentage
- Revenue
- Remaining time
- Violation status
- Renewal status

## Hardware store

Filters:

- Category
- Generation
- Rack size
- Price
- Efficiency
- Unlocked status

## Research view

Displays a node-based or column-based research tree.

## Company view

Displays:

- Reputation tier
- Lifetime revenue
- Customers served
- Contract success rate
- Highest uptime
- Prestige progress
- Achievements

---

# 29. Visual direction

## Style

Clean cyber-industrial interface with readable technical elements.

The game should look like a polished infrastructure dashboard rather than a spreadsheet with commitment issues.

## Rack visuals

Racks should show:

- Individual equipment faces
- Status lights
- Network activity
- Fan animation
- Temperature warnings
- Empty rack units
- Powered-down equipment
- Contract activity indicators

## Implementation

Use:

- HTML
- CSS
- SVG
- Lightweight transitions

Do not require a game canvas or 3D engine.

---

# 30. Technology stack

## Front end

- React
- TypeScript
- Vite
- Tailwind CSS

## State

- Zustand
- Immer middleware if useful
- Versioned persistence layer

## Drag and drop

- dnd-kit

## Charts

- Recharts

## Animation

- Framer Motion or CSS transitions

## Testing

- Vitest
- React Testing Library
- Playwright after MVP

## Deployment

- Vercel
- Cloudflare Pages
- GitHub Pages

The application must remain fully static and require no back-end service during the MVP.

---

# 31. Project architecture

```text
src/
├── app/
│   ├── App.tsx
│   ├── routes.tsx
│   └── providers.tsx
├── components/
│   ├── common/
│   ├── dashboard/
│   ├── facility/
│   ├── racks/
│   ├── contracts/
│   ├── hardware/
│   └── research/
├── data/
│   ├── equipment.ts
│   ├── racks.ts
│   ├── facilities.ts
│   ├── services.ts
│   ├── customers.ts
│   ├── research.ts
│   └── progression.ts
├── game/
│   ├── simulation/
│   │   ├── advanceGame.ts
│   │   ├── calculateRack.ts
│   │   ├── calculatePool.ts
│   │   ├── calculateContracts.ts
│   │   ├── calculateExpenses.ts
│   │   └── offlineProgress.ts
│   ├── contracts/
│   │   ├── generateContract.ts
│   │   ├── renewContract.ts
│   │   └── customerGrowth.ts
│   ├── progression/
│   │   ├── reputation.ts
│   │   ├── unlocks.ts
│   │   └── research.ts
│   ├── persistence/
│   │   ├── saveGame.ts
│   │   ├── loadGame.ts
│   │   └── migrations.ts
│   └── random/
│       └── seededRandom.ts
├── store/
│   ├── gameStore.ts
│   └── selectors.ts
├── types/
│   ├── game.ts
│   ├── equipment.ts
│   ├── contracts.ts
│   └── progression.ts
├── utils/
│   ├── formatting.ts
│   ├── numbers.ts
│   └── time.ts
└── tests/
    ├── simulation/
    ├── contracts/
    └── progression/
```

---

# 32. State shape

```ts
interface GameState {
  version: number;
  company: {
    name: string;
    cash: number;
    reputation: number;
    researchPoints: number;
    lifetimeRevenue: number;
    currentTier: string;
  };
  facilities: FacilityInstance[];
  activeFacilityId: string;
  inventory: EquipmentInstance[];
  contracts: {
    offers: ContractInstance[];
    active: ContractInstance[];
    completedCount: number;
  };
  customers: CustomerState[];
  research: {
    unlockedNodeIds: string[];
  };
  progression: {
    completedMilestones: string[];
    prestigeCurrency: number;
  };
  statistics: {
    startedAt: number;
    lastSavedAt: number;
    totalOnlineSeconds: number;
    totalOfflineSeconds: number;
    contractsCompleted: number;
    contractsBreached: number;
    highestIncomePerSecond: number;
  };
  settings: {
    soundEnabled: boolean;
    reducedMotion: boolean;
    compactNumbers: boolean;
    autosaveEnabled: boolean;
  };
}
```

---

# 33. Persistence

## Save behavior

- Autosave is enabled by default every five minutes.
- Players may choose 1, 5, 10, 15, or 30 minute intervals.
- Save when major transactions occur.
- Save when the browser tab becomes hidden.
- Save before unload when supported.

## Save format

- JSON
- Stored in localStorage
- Includes version number
- Supports migrations

## User controls

- Export save
- Import save
- Reset game
- Copy save to clipboard

---

# 34. Number formatting

Revenue should progress through readable abbreviations.

Examples:

- $1,240
- $82.4K
- $4.71M
- $2.16B
- $900T

Late-game values may use scientific notation after named suffixes become impractical.

Internally, normal JavaScript numbers are acceptable for the MVP.

A big-number library should only be introduced when the progression actually requires it.

---

# 35. Audio

Audio is optional for MVP polish.

Potential sounds:

- Equipment installed
- Contract accepted
- Contract completed
- Rack powered on
- Research unlocked
- Facility purchased
- Warning alarm
- Cash milestone

Audio must include a global mute option.

---

# 36. Accessibility

Requirements:

- Full keyboard navigation for menus
- Text labels for status indicators
- Reduced-motion option
- Do not communicate errors through color alone
- Sufficient contrast
- Tooltips available through keyboard focus
- Responsive layout

Mobile does not need to be the ideal experience, but the dashboard and contract controls should remain usable.

---

# 37. MVP content

## Facilities

- Bedroom
- Office server closet

## Rack types

- Starter 12U rack
- Standard 24U rack
- Standard 42U rack

## Equipment

- Refurbished desktop server
- Used 2U compute server
- Modern 1U compute server
- Basic NAS
- 4U storage array
- Consumer router
- Gigabit switch
- Power strip
- Basic UPS
- Desk fan
- Rack fan panel
- Portable air conditioner

## Contract services

- Website hosting
- File storage
- Backup hosting
- Game servers

## Reputation tiers

- Bedroom Host
- Local Provider
- Regional Provider

## Customers

- Procedural customers
- Three anchor customers
- Four stages for each anchor customer

## Core systems

- Rack building
- Equipment placement
- Contract marketplace
- Contract assignment
- Revenue simulation
- Power and cooling
- Electricity expense
- Facility rent
- Reputation
- Research
- Saving
- Offline progress

---

# 38. Features explicitly excluded from MVP

Do not add these until the core game is already fun:

- Employees
- Staff schedules
- Actual network cable routing
- Packet-level simulation
- Detailed drive speed
- Hardware wear and component health
- Cybersecurity attacks
- Multiple geographic regions
- Competitive multiplayer
- Cloud accounts
- User authentication
- Back-end database
- Equipment crafting
- Auctions
- Stock market mechanics
- Complex prestige
- Real hardware brands
- 3D graphics

These features are forbidden scope snacks until the MVP is complete.

---

# 39. Development phases

## Phase 1: Simulation foundation

Build:

- Type definitions
- Equipment data
- Rack data
- Facility data
- Rack capacity calculator
- Power calculator
- Cooling calculator
- Contract fulfillment calculator
- Revenue and expense calculator
- Unit tests

Completion requirement:

The simulation can run entirely through tests without the React UI.

## Phase 2: Playable vertical slice

Phase 2 delivers the first complete browser-playable loop while preserving the
pure Phase 1 simulation boundary. The application uses explicit boot, main-menu,
setup, save-manager, options, credits, and active-game screen states. The active
game exposes only Facility, Contracts, Hardware Store, and the pause menu.

The main menu supports Continue, New Game, Load Game, Options, and Credits.
Continue selects the most recently played valid save. Browser builds do not show
a fake Quit action; application capabilities reserve that action for a future
desktop adapter.

Five reusable local save slots are supported. Each slot reports company, cash,
reputation tier, playtime, last-played timestamp, schema version, development
modification status, and health. Save health is empty, valid, recoverable, or
invalid. Slot operations include create or overwrite, load, save, delete, JSON
export, validated JSON import, and last-known-good backup restoration. Browser
save writes use isolated temporary, current, backup, and preserved-corrupt
records. Import validation occurs before any current data is replaced. Invalid
or unsupported data is never silently reset or deleted.

All bottom-right typed notifications expire automatically. Success and
information notices last five seconds; warnings and errors last eight seconds
and remain recorded in bounded diagnostics after their toast disappears.
Repeated autosaves replace the prior save notification and reset its timer.

Global options are stored separately from game slots. Phase 2 options are fixed
UI scale, reduced motion, compact or expanded number formatting, autosave,
fixed autosave intervals, and fullscreen when the platform supports it. Audio
settings remain outside Phase 2 because audio does not exist yet.

Interface scale changes preview immediately while Options is open. Leaving
without saving restores the persisted scale. Autosave intervals are 1, 5, 10,
15, and 30 minutes, with five minutes as the default. Legacy Phase 2 option
records using 10 or 30 seconds migrate to one minute; the legacy 60-second
choice remains one minute.

The playable slice begins in the bedroom with the Phase 1 starter rack, four
inventory items, zero cash, and Gravy's Garden Blog offer. Electricity expense
is explicitly waived by the pure simulation until the tutorial completes or
fails. The Facility screen provides a keyboard- and click-operable 12U grid,
pointer and touch drag interactions, inventory installation, direct rack-face
movement, removal controls, power toggles, live capacity telemetry, and explicit
power or cooling throttling warnings. Rack-unit selection is an anchor: large
items clamp naturally at rack edges, choose the nearest valid span, and
deterministically reflow existing hardware when necessary. Click, keyboard, and
drag interactions all commit through the same typed pure layout command.
Installed rack faces are the only drag and keyboard-move handles. Inventory and
Installed Controls scroll independently within bounded panels, including the
full-rack and 30-item QA stress states.

The tutorial offer can be accepted and assigned to the starter rack and remains
recoverable until acceptance. The Contracts screen shows requirements,
per-resource fulfillment, duration, revenue multiplier output, actual revenue,
SLA state, total and remaining SLA buffer, and remaining time. Time below 100%
fulfillment consumes the buffer, while healthy service recovers it at the
centralized recovery rate. SLA buffer seconds use one duration-based rule:
`clamp(round(total duration × 0.10), 5, 45)`. The 30-second tutorial therefore
has a five-second buffer. Readiness labels distinguish missing hardware from
an actual capacity shortfall. Completion grants the centralized tutorial
reputation reward, records the tutorial milestone, unlocks the bedroom hardware
store, and fills three deterministic Bedroom Host marketplace slots. Accepting,
rejecting, or expiring a starter offer deterministically refills its slot from
the saved RNG state. Negotiation, renewal, growth, rack groups, and enterprise
contracts are not Phase 2 systems.

The Contracts screen reports total, active-demand reservations, remaining
consumable capacity, projected post-acceptance capacity, aggregate fulfillment,
and exact shortages. Compute, GPU compute, storage, and bandwidth are consumed;
reliability and security are capability checks. The pure accept command refuses
offers whose projected aggregate fulfillment is below 100% using the shared
readiness epsilon.

The Hardware Store lists currently unlocked bedroom-compatible Phase 1
equipment with price, rack size, output, power, heat, reliability, and category.
Purchases update cash and inventory atomically through a pure typed command.
Each instance records its acquisition price. Inventory equipment can be sold
atomically for half that price, rounded to cents. Starter items record $0,
remain sale-locked until the tutorial completes, and then have no resale value.
Installed equipment must return to inventory before sale. Scrapping is not
available in this phase.

Runtime coordination belongs outside `src/game/**`. One runtime owner advances
elapsed browser time, avoids duplicate Strict Mode tick loops, supports autosave
and development speed multipliers, saves on document hiding and menu return,
and reports saving, saved, or failed only after repository confirmation. Offline
earnings remain a Phase 3 concern.

Development and QA builds provide an F10 control deck. It is draggable,
resizable, minimizable, keyboard reachable, bounded to the viewport, and offers
typed economy, time, contract, scenario, diagnostic, and one-step undo commands.
Every accepted command validates the resulting game state, appends to a bounded
log, creates one undo snapshot, and marks subsequent saves as development
modified. The normal release build removes the development panel module from
its output rather than hiding it.

Expected storage, import, migration, and command failures produce actionable
messages. Unexpected React, runtime-loop, global error, and unhandled-rejection
failures enter a recovery UI with diagnostic copy, valid-state export, reload,
and return-to-menu controls. Bootstrap failures render a styled fatal fallback
instead of a blank page. Error history is in-memory and bounded; no telemetry is
sent anywhere.

Tutorial SLA exhaustion persists a terminal tutorial-failed state, autosaves,
and returns to the game-over screen after reload. Debt remains playable below
$0. Cash-based failure occurs only at the centralized bankruptcy threshold of
-$10,000. Crossing that threshold preserves the exact cash value, persists the
terminal state, stops normal simulation, and offers return, export, and
confirmed delete/start-over actions. Existing version-one saves migrate through
version two to save version three. Version-two tutorials preserve active
completion percentage and consumed SLA percentage while moving to the
30-second duration and duration-derived buffer. Completed and terminal
tutorials remain complete or terminal. Known starter instances infer a $0
acquisition price; other version-two instances infer the equipment purchase
cost because Phase 2 had no discounts. IDs, locations, power states, and cash
are preserved.

The placeholder interface is desktop-first and cyber-industrial, with semantic
controls, visible keyboard focus, reduced-motion support, responsive save and
options screens, and no horizontal clipping at the required desktop viewports.
Final art is intentionally outside Phase 2.

Completion requirement:

A player can create a named company in one of five safe slots, build the starter
rack without relying on drag and drop, accept and assign the tutorial contract,
watch simulation-backed income change, unlock the starter store and marketplace,
save, return to the menu, refresh, and restore the same progress. Release, QA,
unit, architecture, dead-code, coverage, browser, accessibility, and rendered
inspection gates must pass before Phase 2 is complete.

## Phase 3: Early progression

Build:

- Reputation
- Research
- Additional equipment
- 24U and 42U racks
- Office server closet
- Customer renewals
- Customer growth
- Offline progress

Completion requirement:

A player can progress from the bedroom into the office server closet.

## Phase 4: Specialization

Build:

- Rack specialization
- Game-server contracts
- Backup contracts
- Rack templates
- Contract filters
- Better performance UI
- Anchor customers

Completion requirement:

Different rack builds produce meaningfully different outcomes.

## Phase 5: Polish

Build:

- Rack animations
- Charts
- Sound
- Achievements
- Export and import save
- Responsive UI
- Accessibility pass
- Tutorial
- Portfolio presentation

---

# 40. First playable scenario

The player begins with:

- $0
- One bedroom facility
- One empty 12U rack
- One refurbished desktop server
- One consumer router
- One power strip
- One desk fan

Tutorial contract:

```text
Customer: Gravy's Garden Blog
Service: Website Hosting

Requirements:
20 Compute
5 Storage
10 Mbps Bandwidth
80% Reliability

Revenue:
$2 per second

Duration:
30 seconds
```

The player installs the equipment, assigns the contract, and begins earning revenue.

Electricity is waived until this tutorial completes or fails. Successful
completion pays enough to purchase at least one meaningful starter item. A
tutorial SLA breach is a persistent game-over condition. Debt above -$10,000 is
allowed; reaching or crossing -$10,000 triggers bankruptcy.

After completing the tutorial contract:

- The hardware store expands.
- Three marketplace offers appear.
- The player gains reputation.
- Research becomes available.

---

# 41. MVP success criteria

The MVP is successful when:

- The player understands how racks generate contract capacity.
- Replacing equipment visibly improves performance.
- At least two valid rack strategies exist.
- The player can reach the second facility.
- Contracts provide clear reasons to upgrade.
- Offline earnings work correctly.
- The game runs without a server.
- The first thirty minutes contain meaningful decisions.
- The player regularly sees income increase.
- The UI clearly explains power, heat, and contract shortages.

---

# 42. Core design rule

Every major progression system must answer one of these questions:

- What should I build next?
- What should I replace?
- Which contract should I accept?
- Where should this workload run?
- How can I make this rack more efficient?
- What can I automate now?

Any feature that does not strengthen one of those decisions should probably be cut.
