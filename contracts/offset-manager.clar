;; OffsetManager Smart Contract
;; Core contract for managing carbon offsets, minting Carbon Credit Tokens (CCT), 
;; and linking user footprints to renewable investments.
;; This contract handles offset requests, token minting, burning for retirement,
;; admin controls, and verifiable records. It assumes interactions with external
;; contracts like CarbonCalculator for footprint data and InvestmentPool for fund allocation.

;; Constants
(define-constant ERR-UNAUTHORIZED u100)
(define-constant ERR-PAUSED u101)
(define-constant ERR-INVALID-AMOUNT u102)
(define-constant ERR-INVALID-RECIPIENT u103)
(define-constant ERR-INVALID-OFFSETTER u104)
(define-constant ERR-ALREADY-REGISTERED u105)
(define-constant ERR-METADATA-TOO-LONG u106)
(define-constant ERR-INSUFFICIENT-PAYMENT u107)
(define-constant ERR-INVALID-POOL u108)
(define-constant ERR-OFFSET-ALREADY-RETIRED u109)
(define-constant ERR-INVALID-STATUS u110)
(define-constant MAX-METADATA-LEN u512)
(define-constant MIN-OFFSET-AMOUNT u1)
(define-constant DEFAULT-OFFSET-FEE u100) ;; In micro-STX per ton of CO2

;; Fungible Token Definition (CCT - Carbon Credit Token)
(define-fungible-token cct u1000000000) ;; Max supply: 1 billion tokens (1 token = 1 ton CO2 offset)

;; Data Variables
(define-data-var contract-admin principal tx-sender)
(define-data-var contract-paused bool false)
(define-data-var total-offsets uint u0)
(define-data-var offset-counter uint u0)
(define-data-var offset-fee uint DEFAULT-OFFSET-FEE)

;; Data Maps
(define-map offsetters principal bool) ;; Authorized offset providers (minters)
(define-map user-offsets principal {total-offset: uint, active-offset: uint, retired-offset: uint, last-offset-time: uint})
(define-map offset-records 
    {offset-id: uint} 
    {
        user: principal,
        amount: uint, ;; Tons of CO2
        pool: principal, ;; Investment pool contract
        payment: uint, ;; STX paid
        metadata: (string-utf8 512), ;; e.g., "Offset from solar project X"
        timestamp: uint,
        status: (string-ascii 20), ;; "active", "retired", "pending"
        verified: bool
    }
)
(define-map offset-versions 
    {offset-id: uint, version: uint} 
    {
        updated-amount: uint,
        update-notes: (string-utf8 256),
        timestamp: uint
    }
)
(define-map offset-licenses 
    {offset-id: uint, licensee: principal} 
    {
        expiry: uint,
        terms: (string-utf8 256),
        active: bool
    }
)
(define-map offset-categories 
    {offset-id: uint} 
    {
        category: (string-ascii 50), ;; e.g., "renewable-energy", "reforestation"
        tags: (list 10 (string-ascii 20))
    }
)
(define-map collaborators 
    {offset-id: uint, collaborator: principal} 
    {
        role: (string-ascii 50),
        permissions: (list 5 (string-ascii 20)),
        added-at: uint
    }
)
(define-map revenue-shares 
    {offset-id: uint, participant: principal} 
    {
        percentage: uint,
        total-received: uint
    }
)

;; Read-Only Functions
(define-read-only (get-contract-admin)
    (var-get contract-admin)
)

(define-read-only (is-paused)
    (var-get contract-paused)
)

(define-read-only (get-total-offsets)
    (var-get total-offsets)
)

(define-read-only (get-offset-fee)
    (var-get offset-fee)
)

(define-read-only (get-user-offsets (user principal))
    (default-to {total-offset: u0, active-offset: u0, retired-offset: u0, last-offset-time: u0} 
        (map-get? user-offsets user))
)

(define-read-only (get-offset-record (offset-id uint))
    (map-get? offset-records {offset-id: offset-id})
)

(define-read-only (get-offset-version (offset-id uint) (version uint))
    (map-get? offset-versions {offset-id: offset-id, version: version})
)

(define-read-only (is-offsetter (account principal))
    (default-to false (map-get? offsetters account))
)

(define-read-only (get-balance (account principal))
    (ft-get-balance cct account)
)

(define-read-only (get-total-supply)
    (ft-get-supply cct)
)

(define-read-only (verify-offset (offset-id uint))
    (let ((record (unwrap! (map-get? offset-records {offset-id: offset-id}) (err ERR-INVALID-AMOUNT))))
        (and (get verified record) (is-eq (get status record) "active"))
    )
)

;; Public Functions
(define-public (set-admin (new-admin principal))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
        (var-set contract-admin new-admin)
        (ok true)
    )
)

(define-public (pause-contract)
    (begin
        (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
        (var-set contract-paused true)
        (ok true)
    )
)

(define-public (unpause-contract)
    (begin
        (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
        (var-set contract-paused false)
        (ok true)
    )
)

(define-public (add-offsetter (offsetter principal))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
        (asserts! (not (is-offsetter offsetter)) (err ERR-ALREADY-REGISTERED))
        (map-set offsetters offsetter true)
        (ok true)
    )
)

(define-public (remove-offsetter (offsetter principal))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
        (map-set offsetters offsetter false)
        (ok true)
    )
)

(define-public (set-offset-fee (new-fee uint))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
        (var-set offset-fee new-fee)
        (ok true)
    )
)

(define-public (offset-emissions (amount uint) (pool principal) (metadata (string-utf8 512)))
    (let 
        (
            (required-payment (* amount (var-get offset-fee)))
            (current-offsets (get-user-offsets tx-sender))
            (offset-id (+ (var-get offset-counter) u1))
        )
        (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
        (asserts! (>= amount MIN-OFFSET-AMOUNT) (err ERR-INVALID-AMOUNT))
        (asserts! (<= (len metadata) MAX-METADATA-LEN) (err ERR-METADATA-TOO-LONG))
        (asserts! (is-offsetter tx-sender) (err ERR-INVALID-OFFSETTER)) ;; For now, user is offsetter; later integrate
        ;; Assume pool validation; in real, call pool contract
        (asserts! (not (is-eq pool tx-sender)) (err ERR-INVALID-POOL))
        (try! (stx-transfer? required-payment tx-sender pool)) ;; Transfer to investment pool
        (try! (ft-mint? cct amount tx-sender)) ;; Mint CCT
        (map-set offset-records 
            {offset-id: offset-id}
            {
                user: tx-sender,
                amount: amount,
                pool: pool,
                payment: required-payment,
                metadata: metadata,
                timestamp: block-height,
                status: "active",
                verified: false ;; Pending verification
            }
        )
        (map-set user-offsets tx-sender
            {
                total-offset: (+ (get total-offset amount current-offsets) amount),
                active-offset: (+ (get active-offset amount current-offsets) amount),
                retired-offset: (get retired-offset current-offsets),
                last-offset-time: block-height
            }
        )
        (var-set total-offsets (+ (var-get total-offsets) amount))
        (var-set offset-counter offset-id)
        (ok offset-id)
    )
)

(define-public (retire-offset (offset-id uint))
    (let 
        (
            (record (unwrap! (map-get? offset-records {offset-id: offset-id}) (err ERR-INVALID-AMOUNT)))
            (user-offsets (get-user-offsets (get user record)))
        )
        (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
        (asserts! (is-eq tx-sender (get user record)) (err ERR-UNAUTHORIZED))
        (asserts! (is-eq (get status record) "active") (err ERR-OFFSET-ALREADY-RETIRED))
        (try! (ft-burn? cct (get amount record) tx-sender)) ;; Burn CCT to retire
        (map-set offset-records {offset-id: offset-id}
            (merge record {status: "retired", verified: true})
        )
        (map-set user-offsets (get user record)
            {
                total-offset: (get total-offset user-offsets),
                active-offset: (- (get active-offset user-offsets) (get amount record)),
                retired-offset: (+ (get retired-offset user-offsets) (get amount record)),
                last-offset-time: block-height
            }
        )
        (ok true)
    )
)

(define-public (verify-offset-record (offset-id uint))
    (let ((record (unwrap! (map-get? offset-records {offset-id: offset-id}) (err ERR-INVALID-AMOUNT))))
        (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
        (map-set offset-records {offset-id: offset-id}
            (merge record {verified: true})
        )
        (ok true)
    )
)

(define-public (update-offset-version (offset-id uint) (version uint) (new-amount uint) (notes (string-utf8 256)))
    (let ((record (unwrap! (map-get? offset-records {offset-id: offset-id}) (err ERR-INVALID-AMOUNT))))
        (asserts! (is-eq tx-sender (get user record)) (err ERR-UNAUTHORIZED))
        (asserts! (is-eq (get status record) "active") (err ERR-INVALID-STATUS))
        (map-set offset-versions {offset-id: offset-id, version: version}
            {
                updated-amount: new-amount,
                update-notes: notes,
                timestamp: block-height
            }
        )
        (ok true)
    )
)

(define-public (grant-offset-license (offset-id uint) (licensee principal) (duration uint) (terms (string-utf8 256)))
    (let ((record (unwrap! (map-get? offset-records {offset-id: offset-id}) (err ERR-INVALID-AMOUNT))))
        (asserts! (is-eq tx-sender (get user record)) (err ERR-UNAUTHORIZED))
        (map-set offset-licenses {offset-id: offset-id, licensee: licensee}
            {
                expiry: (+ block-height duration),
                terms: terms,
                active: true
            }
        )
        (ok true)
    )
)

(define-public (add-offset-category (offset-id uint) (category (string-ascii 50)) (tags (list 10 (string-ascii 20))))
    (let ((record (unwrap! (map-get? offset-records {offset-id: offset-id}) (err ERR-INVALID-AMOUNT))))
        (asserts! (is-eq tx-sender (get user record)) (err ERR-UNAUTHORIZED))
        (map-set offset-categories {offset-id: offset-id}
            {category: category, tags: tags}
        )
        (ok true)
    )
)

(define-public (add-collaborator (offset-id uint) (collaborator principal) (role (string-ascii 50)) (permissions (list 5 (string-ascii 20))))
    (let ((record (unwrap! (map-get? offset-records {offset-id: offset-id}) (err ERR-INVALID-AMOUNT))))
        (asserts! (is-eq tx-sender (get user record)) (err ERR-UNAUTHORIZED))
        (map-set collaborators {offset-id: offset-id, collaborator: collaborator}
            {
                role: role,
                permissions: permissions,
                added-at: block-height
            }
        )
        (ok true)
    )
)

(define-public (set-revenue-share (offset-id uint) (participant principal) (percentage uint))
    (let ((record (unwrap! (map-get? offset-records {offset-id: offset-id}) (err ERR-INVALID-AMOUNT))))
        (asserts! (is-eq tx-sender (get user record)) (err ERR-UNAUTHORIZED))
        (asserts! (<= percentage u100) (err ERR-INVALID-AMOUNT))
        (map-set revenue-shares {offset-id: offset-id, participant: participant}
            {
                percentage: percentage,
                total-received: u0
            }
        )
        (ok true)
    )
)

(define-public (transfer-cct (amount uint) (recipient principal))
    (begin
        (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
        (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
        (try! (ft-transfer? cct amount tx-sender recipient))
        (ok true)
    )
)