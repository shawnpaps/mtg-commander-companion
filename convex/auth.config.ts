/**
 * Tells Convex which issuer to trust for JWTs. `applicationID` must match the
 * `aud` claim, which means the Clerk dashboard needs a JWT template literally
 * named "convex" (Clerk ships one as a preset).
 *
 * The domain comes from a Convex environment variable so dev and production can
 * point at different Clerk instances. Convex rejects the push if it isn't set,
 * so a new deployment needs:
 *
 *   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-instance>
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
