# Home Assistant integrations

The directories in this folder are complete standalone repositories imported
with Git subtrees. The standalone repositories are the source of truth and are
published independently through HACS.

## Pull upstream changes

```bash
git subtree pull --prefix=integrations/ha-metadata-exporter \
  https://github.com/poesterlin/ha-metadata-exporter.git main --squash

git subtree pull --prefix=integrations/ha-display-notifications \
  https://github.com/poesterlin/ha-display-notifications.git main --squash
```

## Push monorepo changes upstream

```bash
git subtree push --prefix=integrations/ha-metadata-exporter \
  https://github.com/poesterlin/ha-metadata-exporter.git main

git subtree push --prefix=integrations/ha-display-notifications \
  https://github.com/poesterlin/ha-display-notifications.git main
```

Make integration releases and run HACS validation in the standalone repositories,
not in this monorepo.
