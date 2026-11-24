-- Strip accidental leading '#' prefixes from expenses.tags and deduplicate case-insensitively.
update public.expenses e
set tags = coalesce(
    (
        select array_agg(dedup.tag order by dedup.first_ord)
        from (
            select
                min(ord) as first_ord,
                (array_agg(clean_tag order by ord))[1] as tag
            from (
                select
                    ord,
                    btrim(regexp_replace(btrim(raw_tag), '^#+', '')) as clean_tag
                from unnest(e.tags) with ordinality as u(raw_tag, ord)
            ) cleaned
            where clean_tag <> ''
            group by lower(clean_tag)
        ) dedup
    ),
    '{}'::text[]
)
where exists (
    select 1
    from unnest(e.tags) as t
    where btrim(t) ~ '^#+'
);
