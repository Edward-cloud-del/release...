export interface User {
	id: string;
	email: string;
	name: string;
	tier: string;
	subscription_status: string;
	stripe_customer_id?: string;
	usage_daily: number;
	usage_total: number;
	created_at: string;
	updated_at: string;
	token?: string;
}

class UserService {
  private static instance: UserService;

	private accessToken?: string;

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

	setAccessToken(token: string) {
		this.accessToken = token;
	}

	clearAccessToken() {
		this.accessToken = undefined;
	}

	getAuthHeader(): Record<string, string> {
		return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}
	}

}

export default UserService.getInstance();
