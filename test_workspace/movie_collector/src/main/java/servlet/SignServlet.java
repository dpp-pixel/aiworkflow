package servlet;

import java.io.*;
import javax.servlet.*;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import dao.MovieDAO;
import model.Member;

@WebServlet("/SignServlet.do")
public class SignServlet extends HttpServlet {
	private static final long serialVersionUID = 1L;

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {

		request.setCharacterEncoding("utf-8");
		response.setContentType("text/html; charset=UTF-8");
		PrintWriter out = response.getWriter();

		String id = request.getParameter("id");
		String password = request.getParameter("password");
		String email = request.getParameter("email");
		String nickname = request.getParameter("nickname");

		//1. 빈 값 체크
		if (id == null || id.trim().isEmpty() || password == null || password.trim().isEmpty() || email == null || email.trim().isEmpty() || nickname == null || nickname.trim().isEmpty()) {

			out.println("<script>");
			out.println("alert('모든 항목을 입력해야 합니다.');");
			out.println("history.back();");
			out.println("</script>");
			return;
		}

		Member m = new Member();
		m.setId(id);
		m.setPw(password);
		m.setEmail(email);
		m.setNickname(nickname);

		MovieDAO dao = new MovieDAO();
		int result = dao.insertMember(m);

		if (result > 0) {
			out.println("<script>");
			out.println("alert('회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.');");
			out.println("location.href='login.jsp';");
			out.println("</script>");
		} else {
			out.println("<script>");
			out.println("alert('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');");
			out.println("history.back();");
			out.println("</script>");
		}
		if (dao.isIdExists(id)) {
			out.println("<script>");
			out.println("alert('이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.');");
			out.println("history.back();");
			out.println("</script>");
			return;
		}

		if (dao.isEmailExists(email)) {
			out.println("<script>");
			out.println("alert('이미 가입된 이메일입니다. 다른 이메일을 입력해주세요.');");
			out.println("history.back();");
			out.println("</script>");
			return;
		}
	}
}
