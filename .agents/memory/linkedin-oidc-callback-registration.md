# LinkedIn OIDC callback registration

The generic allauth OpenID Connect provider constructs the callback as
`/accounts/oidc/<provider_id>/login/callback/`. LinkedIn's Auth settings must
contain the exact absolute URL, including the trailing slash, for every origin
that will initiate the flow. A legacy `/accounts/linkedin/login/callback/`
entry does not match and LinkedIn rejects the authorization request before
consent. Verify the provider-side registered URLs directly, then perform one
real consent-and-callback test; a configured client id/secret alone is not
external integration evidence.
