DROP TABLE pdexanalytics.trades;
DROP TABLE pdexanalytics.exchange_daily;
DROP TABLE pdexanalytics.markets_daily;
DROP TABLE pdexanalytics.assets_daily;
DROP TABLE pdexanalytics.markets;
DROP TABLE pdexanalytics.assets;

CREATE TABLE pdexanalytics.assets
(
  asset_id varchar(64) not null,
  symbol varchar(60) not null,
  name varchar(60) not null,
  price decimal(20,10),
  tvl decimal(12,2),
  is_active bit not null,
  PRIMARY KEY (asset_id)
);

ALTER TABLE assets ADD INDEX symbol_index (symbol);

CREATE TABLE pdexanalytics.markets
(
  base_asset_id varchar(64) not null,
  quote_asset_id varchar(64) not null,
  is_active bit not null,
  PRIMARY KEY (base_asset_id, quote_asset_id),
  FOREIGN KEY (base_asset_id) REFERENCES assets(asset_id),
  FOREIGN KEY (quote_asset_id) REFERENCES assets(asset_id)
);

CREATE TABLE pdexanalytics.trades
(
  trade_id bigint not null,
  base_asset_id varchar(64) not null,
  quote_asset_id varchar(64) not null,
  price decimal(20,10) not null,
  quantity decimal(20,10) not null,
  volume decimal(12,2),
  timestamp datetime not null,
  PRIMARY KEY (trade_id),
  FOREIGN KEY (base_asset_id) REFERENCES assets(asset_id),
  FOREIGN KEY (quote_asset_id) REFERENCES assets(asset_id)
);

ALTER TABLE trades ADD INDEX timestamp_index (timestamp);
ALTER TABLE trades add INDEX market_index (base_asset_id, quote_asset_id);

CREATE TABLE pdexanalytics.exchange_daily
(
  stat_date date not null,
  tvl decimal(12,2),
  volume decimal(12,2),
  users int,
  trades int,
  total_staked int,
  staked_tvl decimal(12,2),
  PRIMARY KEY (stat_date)
);

CREATE TABLE pdexanalytics.markets_daily
(
  stat_date date not null,
  base_asset_id varchar(64) not null,
  quote_asset_id varchar(64) not null,
  volume decimal(12,2),
  trades int,
  PRIMARY KEY (stat_date, base_asset_id, quote_asset_id),
  FOREIGN KEY (base_asset_id) REFERENCES assets(asset_id),
  FOREIGN KEY (quote_asset_id) REFERENCES assets(asset_id)
);

CREATE TABLE pdexanalytics.assets_daily
(
  stat_date date not null,
  asset_id varchar(64) not null,
  tvl decimal(12,2),
  price decimal(20,10) not null,
  volume decimal(12,2),
  trades int,
  PRIMARY KEY (stat_date, asset_id)
);

CREATE TABLE pdexanalytics.assets_hourly
(
  stat_time timestamp not null,
  asset_id varchar(64) not null,
  tvl decimal(12,2),
  price decimal(20,10) not null,
  PRIMARY KEY (stat_time, asset_id)
);

ALTER TABLE assets_hourly ADD INDEX asset_index (asset_id);

alter table assets add balance decimal(16,6) default null;
alter table assets_daily add balance decimal(16,6) default null;
alter table assets_hourly add balance decimal(16,6) default null;